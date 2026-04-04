import { describe, expect, it, vi } from 'vitest'
import { Address, hash, Keypair, xdr } from '@stellar/stellar-sdk'
import { __smartAccountTestUtils } from './index.js'

function makeAddressAuthEntry(address: string) {
  const nonce = xdr.Int64.fromString('42')
  const invocation = new xdr.SorobanAuthorizedInvocation({
    function: xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(
      new xdr.InvokeContractArgs({
        contractAddress: Address.fromString(address).toScAddress(),
        functionName: 'transfer',
        args: [],
      }),
    ),
    subInvocations: [],
  })

  return new xdr.SorobanAuthorizationEntry({
    credentials: xdr.SorobanCredentials.sorobanCredentialsAddress(
      new xdr.SorobanAddressCredentials({
        address: Address.fromString(address).toScAddress(),
        nonce,
        signatureExpirationLedger: 99,
        signature: xdr.ScVal.scvVoid(),
      }),
    ),
    rootInvocation: invocation,
  })
}

describe('smart-account delegated auth internals', () => {
  it('encodes delegated auth payload with rule ids and delegated signer', () => {
    const signer = Keypair.random()
    const payload = __smartAccountTestUtils.createDelegatedAuthPayload(signer.publicKey(), [0, 7, 9])
    const entries = payload.map() ?? []

    expect(entries).toHaveLength(2)
    const contextEntry = entries.find((entry) => entry.key().sym() === 'context_rule_ids')
    const signerEntry = entries.find((entry) => entry.key().sym() === 'signers')

    expect(contextEntry?.val().vec()?.map((item) => item.u32())).toEqual([0, 7, 9])
    const signerMap = signerEntry?.val().map()
    expect(signerMap).toHaveLength(1)
    const delegatedSigner = signerMap?.[0]?.key().vec()
    expect(delegatedSigner?.[0]?.sym()).toBe('Delegated')
    expect(Address.fromScAddress(delegatedSigner?.[1]?.address() as xdr.ScAddress).toString()).toBe(
      signer.publicKey(),
    )
  })

  it('builds a stable auth digest from payload and rule ids', () => {
    const payload = Buffer.from('xmpp-smart-account-payload')
    const digestA = __smartAccountTestUtils.buildSmartAccountAuthDigest(payload, [0])
    const digestB = __smartAccountTestUtils.buildSmartAccountAuthDigest(payload, [0])
    const digestC = __smartAccountTestUtils.buildSmartAccountAuthDigest(payload, [1])

    expect(digestA.equals(digestB)).toBe(true)
    expect(digestA.equals(digestC)).toBe(false)
    expect(digestA.equals(hash(Buffer.from('xmpp-smart-account-payload')))).toBe(false)
  })

  it('signs only the targeted smart-account auth entry and appends a delegated check_auth entry', () => {
    const smartAccount = Keypair.random()
    const unrelated = Keypair.random()
    const delegatedSigner = Keypair.random()
    const sourceEntry = makeAddressAuthEntry(smartAccount.publicKey())
    const untouchedEntry = makeAddressAuthEntry(unrelated.publicKey())

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(1234567890)
    const signedEntries = __smartAccountTestUtils.signDelegatedSmartAccountAuth(
      [sourceEntry, untouchedEntry],
      smartAccount.publicKey(),
      delegatedSigner,
      555,
      'Test SDF Network ; September 2015',
      [0, 5],
    )
    nowSpy.mockRestore()

    expect(signedEntries).toHaveLength(3)

    const rewrittenSource = signedEntries[0]
    expect(
      Address.fromScAddress(rewrittenSource.credentials().address().address()).toString(),
    ).toBe(smartAccount.publicKey())
    expect(Number(rewrittenSource.credentials().address().signatureExpirationLedger())).toBe(555)
    const payloadMap = rewrittenSource.credentials().address().signature().map()
    expect(payloadMap?.find((entry) => entry.key().sym() === 'context_rule_ids')?.val().vec()?.map((v) => v.u32())).toEqual([0, 5])

    const preservedEntry = signedEntries.find(
      (entry) =>
        Address.fromScAddress(entry.credentials().address().address()).toString() ===
        unrelated.publicKey(),
    )
    expect(preservedEntry?.toXDR('base64')).toBe(untouchedEntry.toXDR('base64'))

    const delegatedEntry = signedEntries.find(
      (entry) =>
        Address.fromScAddress(entry.credentials().address().address()).toString() ===
          delegatedSigner.publicKey() &&
        entry.rootInvocation().function().switch().name ===
          'sorobanAuthorizedFunctionTypeContractFn',
    )
    expect(delegatedEntry).toBeDefined()
    expect(
      Address.fromScAddress(delegatedEntry?.credentials().address().address() as xdr.ScAddress).toString(),
    ).toBe(delegatedSigner.publicKey())
    const delegatedFn = delegatedEntry?.rootInvocation().function().contractFn()
    expect(delegatedFn).toBeDefined()
    expect(delegatedFn!.functionName()).toBe('__check_auth')
    expect(Address.fromScAddress(delegatedFn!.contractAddress()).toString()).toBe(
      smartAccount.publicKey(),
    )
    const signatureVec = delegatedEntry?.credentials().address().signature().vec()
    expect(signatureVec?.[0]?.map()?.some((entry) => entry.key().sym() === 'signature')).toBe(true)
  })

  it('derives the same signature payload for identical auth entries', () => {
    const entry = makeAddressAuthEntry(Keypair.random().publicKey())
    const payloadA = __smartAccountTestUtils.buildSmartAccountSignaturePayload(
      xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR()),
      'Test SDF Network ; September 2015',
    )
    const payloadB = __smartAccountTestUtils.buildSmartAccountSignaturePayload(
      xdr.SorobanAuthorizationEntry.fromXDR(entry.toXDR()),
      'Test SDF Network ; September 2015',
    )

    expect(payloadA.equals(payloadB)).toBe(true)
  })
})
