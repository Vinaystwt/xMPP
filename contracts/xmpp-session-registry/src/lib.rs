#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Symbol};

#[contract]
pub struct XmppSessionRegistryContract;

#[contractimpl]
impl XmppSessionRegistryContract {
    pub fn version(_env: Env) -> Symbol {
        Symbol::new(&_env, "v0.1.0")
    }
}
