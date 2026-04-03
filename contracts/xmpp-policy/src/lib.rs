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

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PauseFlag,
    GlobalPolicy,
    ServicePolicy(String),
    AgentPolicy(String),
    AgentPolicyIds,
}

#[contract]
pub struct XmppPolicyContract;

#[contractimpl]
impl XmppPolicyContract {
    pub fn version(env: &Env) -> Symbol {
        Symbol::new(env, "v0.2.0")
    }

    pub fn bootstrap(env: &Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("xMPP policy contract is already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PauseFlag, &false);
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
}

#[cfg(test)]
mod test {
    use soroban_sdk::{testutils::Address as _, Address, Env, String, Vec};

    use crate::{AgentPolicy, GlobalPolicy, ServicePolicy, XmppPolicyContract, XmppPolicyContractClient};

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
}
