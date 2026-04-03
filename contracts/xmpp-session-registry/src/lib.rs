#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, String, Symbol, Vec};

#[derive(Clone, Debug, Eq, PartialEq)]
#[contracttype]
pub struct SessionRecord {
    pub session_id: String,
    pub service_id: String,
    pub agent: Address,
    pub channel_contract_id: String,
    pub route: String,
    pub status: String,
    pub total_amount_usd_cents: i128,
    pub call_count: u32,
    pub last_receipt_id: String,
    pub updated_at_ledger: u32,
}

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Session(String),
    SessionIds,
    AgentSessionIds(Address),
}

#[contract]
pub struct XmppSessionRegistryContract;

#[contractimpl]
impl XmppSessionRegistryContract {
    pub fn version(env: &Env) -> Symbol {
        Symbol::new(env, "v0.1.0")
    }

    #[allow(clippy::too_many_arguments)]
    pub fn upsert_session(
        env: &Env,
        agent: Address,
        session_id: String,
        service_id: String,
        channel_contract_id: String,
        route: String,
        total_amount_usd_cents: i128,
        call_count: u32,
        last_receipt_id: String,
        status: String,
    ) -> SessionRecord {
        agent.require_auth();

        let session_key = DataKey::Session(session_id.clone());
        let is_new = !env.storage().persistent().has(&session_key);
        let record = SessionRecord {
            session_id: session_id.clone(),
            service_id,
            agent: agent.clone(),
            channel_contract_id,
            route,
            status,
            total_amount_usd_cents,
            call_count,
            last_receipt_id,
            updated_at_ledger: env.ledger().sequence(),
        };

        env.storage().persistent().set(&session_key, &record);

        if is_new {
            let mut session_ids: Vec<String> = env
                .storage()
                .persistent()
                .get(&DataKey::SessionIds)
                .unwrap_or_else(|| Vec::new(env));
            session_ids.push_back(session_id.clone());
            env.storage().persistent().set(&DataKey::SessionIds, &session_ids);

            let agent_key = DataKey::AgentSessionIds(agent);
            let mut agent_session_ids: Vec<String> = env
                .storage()
                .persistent()
                .get(&agent_key)
                .unwrap_or_else(|| Vec::new(env));
            agent_session_ids.push_back(session_id);
            env.storage()
                .persistent()
                .set(&agent_key, &agent_session_ids);
        }

        record
    }

    pub fn get_session(env: &Env, session_id: String) -> Option<SessionRecord> {
        env.storage()
            .persistent()
            .get(&DataKey::Session(session_id))
    }

    pub fn close_session(
        env: &Env,
        agent: Address,
        session_id: String,
        total_amount_usd_cents: i128,
        call_count: u32,
        last_receipt_id: String,
    ) -> Option<SessionRecord> {
        let session_key = DataKey::Session(session_id);
        let mut record: SessionRecord = match env.storage().persistent().get(&session_key) {
            Some(record) => record,
            None => return None,
        };

        if record.agent != agent {
            panic!("only the owning agent can close this session");
        }

        agent.require_auth();
        record.status = String::from_str(env, "closed");
        record.total_amount_usd_cents = total_amount_usd_cents;
        record.call_count = call_count;
        record.last_receipt_id = last_receipt_id;
        record.updated_at_ledger = env.ledger().sequence();

        env.storage().persistent().set(&session_key, &record);
        Some(record)
    }

    pub fn list_sessions(env: &Env) -> Vec<SessionRecord> {
        let ids: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::SessionIds)
            .unwrap_or_else(|| Vec::new(env));

        Self::records_from_ids(env, ids)
    }

    pub fn list_agent_sessions(env: &Env, agent: Address) -> Vec<SessionRecord> {
        let ids: Vec<String> = env
            .storage()
            .persistent()
            .get(&DataKey::AgentSessionIds(agent))
            .unwrap_or_else(|| Vec::new(env));

        Self::records_from_ids(env, ids)
    }

    fn records_from_ids(env: &Env, ids: Vec<String>) -> Vec<SessionRecord> {
        let mut records: Vec<SessionRecord> = Vec::new(env);
        for session_id in ids.iter() {
            if let Some(record) = env
                .storage()
                .persistent()
                .get::<DataKey, SessionRecord>(&DataKey::Session(session_id))
            {
                records.push_back(record);
            }
        }

        records
    }
}

#[cfg(test)]
mod test {
    use soroban_sdk::{testutils::Address as _, Address, Env, String};

    use crate::{SessionRecord, XmppSessionRegistryContract, XmppSessionRegistryContractClient};

    #[test]
    fn upsert_and_list_sessions() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(XmppSessionRegistryContract, ());
        let client = XmppSessionRegistryContractClient::new(&env, &contract_id);
        let agent = Address::generate(&env);
        let session_id = String::from_str(&env, "stream-session-1");
        let service_id = String::from_str(&env, "stream-api");

        let record = client.upsert_session(
            &agent,
            &session_id,
            &service_id,
            &String::from_str(&env, "CCONTRACT"),
            &String::from_str(&env, "mpp-session-open"),
            &5_i128,
            &1_u32,
            &String::from_str(&env, "receipt-open"),
            &String::from_str(&env, "open"),
        );

        assert_eq!(client.get_session(&session_id), Some(record.clone()));
        assert_eq!(client.list_sessions().len(), 1);
        assert_eq!(client.list_agent_sessions(&agent).len(), 1);
    }

    #[test]
    fn close_session_updates_state() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(XmppSessionRegistryContract, ());
        let client = XmppSessionRegistryContractClient::new(&env, &contract_id);
        let agent = Address::generate(&env);
        let session_id = String::from_str(&env, "stream-session-2");

        client.upsert_session(
            &agent,
            &session_id,
            &String::from_str(&env, "stream-api"),
            &String::from_str(&env, "CCONTRACT"),
            &String::from_str(&env, "mpp-session-open"),
            &5_i128,
            &1_u32,
            &String::from_str(&env, "receipt-open"),
            &String::from_str(&env, "open"),
        );

        let closed = client
            .close_session(
                &agent,
                &session_id,
                &15_i128,
                &3_u32,
                &String::from_str(&env, "receipt-close"),
            )
            .unwrap();

        let expected = SessionRecord {
            session_id,
            service_id: String::from_str(&env, "stream-api"),
            agent,
            channel_contract_id: String::from_str(&env, "CCONTRACT"),
            route: String::from_str(&env, "mpp-session-open"),
            status: String::from_str(&env, "closed"),
            total_amount_usd_cents: 15,
            call_count: 3,
            last_receipt_id: String::from_str(&env, "receipt-close"),
            updated_at_ledger: 0,
        };

        assert_eq!(closed.status, expected.status);
        assert_eq!(closed.total_amount_usd_cents, expected.total_amount_usd_cents);
        assert_eq!(closed.call_count, expected.call_count);
        assert_eq!(closed.last_receipt_id, expected.last_receipt_id);
    }
}
