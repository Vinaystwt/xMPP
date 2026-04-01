#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct XmppPolicyContract;

#[contractimpl]
impl XmppPolicyContract {
    pub fn version(_env: Env) -> Symbol {
        Symbol::new(&_env, "v0.1.0")
    }
}
