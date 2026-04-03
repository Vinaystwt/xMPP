#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct GlobalPolicy {
    pub max_spend_usd_cents: i128,
    pub allow_unknown_services: bool,
    pub allow_post_autopay: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct ServicePolicy {
    pub service_id: String,
    pub enabled: bool,
    pub max_spend_usd_cents: i128,
    pub preferred_route: String,
    pub allow_session_reuse: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AgentPolicy {
    pub agent_id: String,
    pub enabled: bool,
    pub daily_budget_usd_cents: i128,
    pub allowed_services: Vec<String>,
    pub preferred_routes: Vec<String>,
    pub autopay_methods: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct TreasurySnapshot {
    pub shared_treasury_usd_cents: i128,
    pub total_spent_usd_cents: i128,
    pub payment_count: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct AgentTreasuryState {
    pub agent_id: String,
    pub spent_usd_cents: i128,
    pub payment_count: u32,
    pub last_service_id: String,
    pub last_route: String,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PauseFlag,
    GlobalPolicy,
    ServicePolicy(String),
    AgentPolicy(String),
    AgentPolicyIds,
    SharedTreasuryUsdCents,
    TreasuryTotalSpentUsdCents,
    TreasuryPaymentCount,
    AgentTreasury(String),
    AgentTreasuryIds,
}

#[contract]
pub struct XmppPolicyContract;

#[contractimpl]
impl XmppPolicyContract {
    pub fn version(env: &Env) -> Symbol {
        Symbol::new(env, "v0.3.0")
    }

    pub fn bootstrap(env: &Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("xMPP policy contract is already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PauseFlag, &false);
        env.storage()
            .instance()
            .set(&DataKey::SharedTreasuryUsdCents, &Self::default_shared_treasury_usd_cents());
        env.storage()
            .instance()
            .set(&DataKey::TreasuryTotalSpentUsdCents, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryPaymentCount, &0_u32);
    }

    pub fn admin(env: &Env) -> Option<Address> {
        env.storage().instance().get(&DataKey::Admin)
    }

    pub fn set_global_policy(env: &Env, policy: GlobalPolicy) {
        Self::require_admin(env);
        env.storage().instance().set(&DataKey::GlobalPolicy, &policy);
    }

    pub fn get_global_policy(env: &Env) -> GlobalPolicy {
        env.storage()
            .instance()
            .get(&DataKey::GlobalPolicy)
            .unwrap_or_else(|| Self::default_global_policy())
    }

    pub fn set_service_policy(env: &Env, service_id: String, policy: ServicePolicy) {
        Self::require_admin(env);
        if service_id != policy.service_id {
            panic!("service policy id does not match storage key");
        }

        env.storage()
            .instance()
            .set(&DataKey::ServicePolicy(service_id), &policy);
    }

    pub fn get_service_policy(env: &Env, service_id: String) -> Option<ServicePolicy> {
        env.storage()
            .instance()
            .get(&DataKey::ServicePolicy(service_id))
    }

    pub fn set_agent_policy(env: &Env, agent_id: String, policy: AgentPolicy) {
        Self::require_admin(env);
        if agent_id != policy.agent_id {
            panic!("agent policy id does not match storage key");
        }

        let key = DataKey::AgentPolicy(agent_id.clone());
        let is_new = !env.storage().instance().has(&key);

        env.storage().instance().set(&key, &policy);

        if is_new {
            let mut ids: Vec<String> = env
                .storage()
                .instance()
                .get(&DataKey::AgentPolicyIds)
                .unwrap_or_else(|| Vec::new(env));
            ids.push_back(agent_id);
            env.storage().instance().set(&DataKey::AgentPolicyIds, &ids);
        }
    }

    pub fn get_agent_policy(env: &Env, agent_id: String) -> Option<AgentPolicy> {
        env.storage()
            .instance()
            .get(&DataKey::AgentPolicy(agent_id))
    }

    pub fn list_agent_policies(env: &Env) -> Vec<AgentPolicy> {
        let ids: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::AgentPolicyIds)
            .unwrap_or_else(|| Vec::new(env));

        let mut policies = Vec::new(env);
        for agent_id in ids.iter() {
            if let Some(policy) = env
                .storage()
                .instance()
                .get::<DataKey, AgentPolicy>(&DataKey::AgentPolicy(agent_id))
            {
                policies.push_back(policy);
            }
        }

        policies
    }

    pub fn set_shared_treasury_usd_cents(env: &Env, amount_usd_cents: i128) {
        Self::require_admin(env);
        env.storage()
            .instance()
            .set(&DataKey::SharedTreasuryUsdCents, &amount_usd_cents);
    }

    pub fn get_treasury_snapshot(env: &Env) -> TreasurySnapshot {
        TreasurySnapshot {
            shared_treasury_usd_cents: env
                .storage()
                .instance()
                .get(&DataKey::SharedTreasuryUsdCents)
                .unwrap_or_else(|| Self::default_shared_treasury_usd_cents()),
            total_spent_usd_cents: env
                .storage()
                .instance()
                .get(&DataKey::TreasuryTotalSpentUsdCents)
                .unwrap_or(0_i128),
            payment_count: env
                .storage()
                .instance()
                .get(&DataKey::TreasuryPaymentCount)
                .unwrap_or(0_u32),
        }
    }

    pub fn record_treasury_spend(
        env: &Env,
        agent_id: String,
        service_id: String,
        route: String,
        amount_usd_cents: i128,
    ) -> AgentTreasuryState {
        Self::require_admin(env);

        let total_spent = env
            .storage()
            .instance()
            .get::<DataKey, i128>(&DataKey::TreasuryTotalSpentUsdCents)
            .unwrap_or(0_i128)
            + amount_usd_cents;
        env.storage()
            .instance()
            .set(&DataKey::TreasuryTotalSpentUsdCents, &total_spent);

        let payment_count = env
            .storage()
            .instance()
            .get::<DataKey, u32>(&DataKey::TreasuryPaymentCount)
            .unwrap_or(0_u32)
            + 1_u32;
        env.storage()
            .instance()
            .set(&DataKey::TreasuryPaymentCount, &payment_count);

        let key = DataKey::AgentTreasury(agent_id.clone());
        let existing = env
            .storage()
            .instance()
            .get::<DataKey, AgentTreasuryState>(&key);
        let is_new = existing.is_none();

        let state = AgentTreasuryState {
            agent_id: agent_id.clone(),
            spent_usd_cents: existing
                .as_ref()
                .map(|entry| entry.spent_usd_cents)
                .unwrap_or(0_i128)
                + amount_usd_cents,
            payment_count: existing
                .as_ref()
                .map(|entry| entry.payment_count)
                .unwrap_or(0_u32)
                + 1_u32,
            last_service_id: service_id,
            last_route: route,
        };

        env.storage().instance().set(&key, &state);

        if is_new {
            let mut ids: Vec<String> = env
                .storage()
                .instance()
                .get(&DataKey::AgentTreasuryIds)
                .unwrap_or_else(|| Vec::new(env));
            ids.push_back(agent_id);
            env.storage().instance().set(&DataKey::AgentTreasuryIds, &ids);
        }

        state
    }

    pub fn get_agent_treasury_state(env: &Env, agent_id: String) -> Option<AgentTreasuryState> {
        env.storage()
            .instance()
            .get(&DataKey::AgentTreasury(agent_id))
    }

    pub fn list_agent_treasury_states(env: &Env) -> Vec<AgentTreasuryState> {
        let ids: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::AgentTreasuryIds)
            .unwrap_or_else(|| Vec::new(env));

        let mut states = Vec::new(env);
        for agent_id in ids.iter() {
            if let Some(state) = env
                .storage()
                .instance()
                .get::<DataKey, AgentTreasuryState>(&DataKey::AgentTreasury(agent_id))
            {
                states.push_back(state);
            }
        }

        states
    }

    pub fn reset_treasury(env: &Env) {
        Self::require_admin(env);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryTotalSpentUsdCents, &0_i128);
        env.storage()
            .instance()
            .set(&DataKey::TreasuryPaymentCount, &0_u32);

        let ids: Vec<String> = env
            .storage()
            .instance()
            .get(&DataKey::AgentTreasuryIds)
            .unwrap_or_else(|| Vec::new(env));
        for agent_id in ids.iter() {
            let state = AgentTreasuryState {
                agent_id: agent_id.clone(),
                spent_usd_cents: 0_i128,
                payment_count: 0_u32,
                last_service_id: String::from_str(env, ""),
                last_route: String::from_str(env, ""),
            };
            env.storage()
                .instance()
                .set(&DataKey::AgentTreasury(agent_id), &state);
        }
    }

    pub fn set_pause_flag(env: &Env, paused: bool) {
        Self::require_admin(env);
        env.storage().instance().set(&DataKey::PauseFlag, &paused);
    }

    pub fn pause_flag(env: &Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::PauseFlag)
            .unwrap_or(false)
    }

    fn require_admin(env: &Env) -> Address {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap_or_else(|| panic!("xMPP policy contract is not initialized"));
        admin.require_auth();
        admin
    }

    fn default_global_policy() -> GlobalPolicy {
        GlobalPolicy {
            max_spend_usd_cents: 100,
            allow_unknown_services: false,
            allow_post_autopay: false,
        }
    }

    fn default_shared_treasury_usd_cents() -> i128 {
        50
    }
}

#[cfg(test)]
mod test {
    use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

    use crate::{
        AgentPolicy, AgentTreasuryState, GlobalPolicy, ServicePolicy, XmppPolicyContract,
        XmppPolicyContractClient,
    };

    #[test]
    fn bootstrap_and_read_defaults() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(XmppPolicyContract, ());
        let client = XmppPolicyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        client.bootstrap(&admin);

        assert_eq!(client.admin(), Some(admin));
        assert_eq!(client.pause_flag(), false);

        let global = client.get_global_policy();
        assert_eq!(global.max_spend_usd_cents, 100);
        assert_eq!(global.allow_unknown_services, false);
        assert_eq!(global.allow_post_autopay, false);
    }

    #[test]
    fn set_global_and_service_policies() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(XmppPolicyContract, ());
        let client = XmppPolicyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.bootstrap(&admin);

        let global = GlobalPolicy {
            max_spend_usd_cents: 250,
            allow_unknown_services: true,
            allow_post_autopay: false,
        };
        client.set_global_policy(&global);
        assert_eq!(client.get_global_policy(), global);

        let service_id = String::from_str(&env, "stream-api");
        let service_policy = ServicePolicy {
            service_id: service_id.clone(),
            enabled: true,
            max_spend_usd_cents: 500,
            preferred_route: String::from_str(&env, "mpp-session-open"),
            allow_session_reuse: true,
        };
        client.set_service_policy(&service_id, &service_policy);

        assert_eq!(client.get_service_policy(&service_id), Some(service_policy));
    }

    #[test]
    fn set_and_read_pause_flag() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(XmppPolicyContract, ());
        let client = XmppPolicyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.bootstrap(&admin);

        client.set_pause_flag(&true);
        assert_eq!(client.pause_flag(), true);
    }

    #[test]
    fn set_and_list_agent_policies() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(XmppPolicyContract, ());
        let client = XmppPolicyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.bootstrap(&admin);

        let agent_id = String::from_str(&env, "research-agent");
        let mut allowed_services = Vec::new(&env);
        allowed_services.push_back(String::from_str(&env, "research-api"));
        let mut preferred_routes = Vec::new(&env);
        preferred_routes.push_back(String::from_str(&env, "x402"));
        let mut autopay_methods = Vec::new(&env);
        autopay_methods.push_back(String::from_str(&env, "GET"));

        let policy = AgentPolicy {
            agent_id: agent_id.clone(),
            enabled: true,
            daily_budget_usd_cents: 15,
            allowed_services,
            preferred_routes,
            autopay_methods,
        };

        client.set_agent_policy(&agent_id, &policy);

        assert_eq!(client.get_agent_policy(&agent_id), Some(policy.clone()));

        let mut expected = Vec::new(&env);
        expected.push_back(policy);
        assert_eq!(client.list_agent_policies(), expected);
    }

    #[test]
    fn record_and_reset_treasury_state() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(XmppPolicyContract, ());
        let client = XmppPolicyContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.bootstrap(&admin);

        client.set_shared_treasury_usd_cents(&50_i128);
        let state = client.record_treasury_spend(
            &String::from_str(&env, "market-agent"),
            &String::from_str(&env, "market-api"),
            &String::from_str(&env, "mpp-charge"),
            &3_i128,
        );

        assert_eq!(
            state,
            AgentTreasuryState {
                agent_id: String::from_str(&env, "market-agent"),
                spent_usd_cents: 3_i128,
                payment_count: 1_u32,
                last_service_id: String::from_str(&env, "market-api"),
                last_route: String::from_str(&env, "mpp-charge"),
            }
        );

        let snapshot = client.get_treasury_snapshot();
        assert_eq!(snapshot.shared_treasury_usd_cents, 50_i128);
        assert_eq!(snapshot.total_spent_usd_cents, 3_i128);
        assert_eq!(snapshot.payment_count, 1_u32);
        assert_eq!(
            client.get_agent_treasury_state(&String::from_str(&env, "market-agent")),
            Some(state.clone())
        );
        assert_eq!(client.list_agent_treasury_states().len(), 1);

        client.reset_treasury();
        let reset_snapshot = client.get_treasury_snapshot();
        assert_eq!(reset_snapshot.total_spent_usd_cents, 0_i128);
        assert_eq!(reset_snapshot.payment_count, 0_u32);
        assert_eq!(
            client.get_agent_treasury_state(&String::from_str(&env, "market-agent")),
            Some(AgentTreasuryState {
                agent_id: String::from_str(&env, "market-agent"),
                spent_usd_cents: 0_i128,
                payment_count: 0_u32,
                last_service_id: String::from_str(&env, ""),
                last_route: String::from_str(&env, ""),
            })
        );
    }
}
