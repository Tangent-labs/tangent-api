import { describe, it, expect, vi, beforeEach } from "vitest"
import { ReferralService } from "../src/services/referral.service.js"
import { UserError } from "../src/utils.js"
import type { ReferralRepository } from "../src/data/referral.data.js"
import type { FastifyBaseLogger } from "fastify"

vi.mock("ethers", () => ({
  ethers: {
    verifyMessage: vi.fn(),
    isAddress: vi.fn(),
  },
}))

import { ethers } from "ethers"

const logger = { info: vi.fn(), error: vi.fn() } as unknown as FastifyBaseLogger

function makeRepo(overrides: Partial<ReferralRepository> = {}): ReferralRepository {
  return {
    getReferralByCode: vi.fn(),
    isUserOnboarded: vi.fn(),
    processReferral: vi.fn(),
    generateReferralCode: vi.fn(),
    getUserStatus: vi.fn(),
    ...overrides,
  } as unknown as ReferralRepository
}

const VALID_INPUT = {
  referralCode: "DNIFCJLU",
  signature: "0xsig",
  account: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  now: "2026-05-25T20:29:47.000Z",
}

const REFERRER = { id: 1n, address: "0x4bb4d9ea2d9618e1341bfa9b7760d91c4efe3013", onboarded: false, code: "DNIFCJLU" }

describe("ReferralService.verifyAndCreateReferralRelationship", () => {
  let repo: ReferralRepository
  let service: ReferralService

  beforeEach(() => {
    repo = makeRepo()
    service = new ReferralService(repo)
    vi.clearAllMocks()
  })

  it("throws UserError when referral code does not exist", async () => {
    vi.mocked(repo.getReferralByCode).mockResolvedValue(null)

    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow(UserError)
    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow("Invalid referral code")
  })

  it("throws UserError when user is already onboarded", async () => {
    vi.mocked(repo.getReferralByCode).mockResolvedValue(REFERRER)
    vi.mocked(repo.isUserOnboarded).mockResolvedValue(true)

    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow(UserError)
    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow("already")
  })

  it("throws UserError when signature is malformed", async () => {
    vi.mocked(repo.getReferralByCode).mockResolvedValue(REFERRER)
    vi.mocked(repo.isUserOnboarded).mockResolvedValue(false)
    vi.mocked(ethers.verifyMessage).mockImplementation(() => { throw new Error("invalid signature") })

    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow(UserError)
    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow("Invalid signature")
  })

  it("throws UserError when signature does not match account", async () => {
    vi.mocked(repo.getReferralByCode).mockResolvedValue(REFERRER)
    vi.mocked(repo.isUserOnboarded).mockResolvedValue(false)
    vi.mocked(ethers.verifyMessage).mockReturnValue("0xDEAD000000000000000000000000000000000000")

    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow(UserError)
    await expect(service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)).rejects.toThrow("does not match")
  })

  it("processes referral and returns success message", async () => {
    vi.mocked(repo.getReferralByCode).mockResolvedValue(REFERRER)
    vi.mocked(repo.isUserOnboarded).mockResolvedValue(false)
    vi.mocked(ethers.verifyMessage).mockReturnValue(VALID_INPUT.account)
    vi.mocked(repo.processReferral).mockResolvedValue(undefined)

    const result = await service.verifyAndCreateReferralRelationship(VALID_INPUT, logger)

    expect(repo.processReferral).toHaveBeenCalledWith(VALID_INPUT.referralCode, VALID_INPUT.account, VALID_INPUT.now)
    expect(result).toEqual({ message: "Referral successfully processed" })
  })
})

describe("ReferralService.generateNewReferralCode", () => {
  let repo: ReferralRepository
  let service: ReferralService

  beforeEach(() => {
    repo = makeRepo()
    service = new ReferralService(repo)
    vi.clearAllMocks()
  })

  it("throws UserError for invalid address", async () => {
    vi.mocked(ethers.isAddress).mockReturnValue(false)

    await expect(service.generateNewReferralCode("not-an-address", logger)).rejects.toThrow(UserError)
  })

  it("returns generated code", async () => {
    vi.mocked(ethers.isAddress).mockReturnValue(true)
    vi.mocked(repo.generateReferralCode).mockResolvedValue("ABCD1234")

    const result = await service.generateNewReferralCode(VALID_INPUT.account, logger)

    expect(result).toEqual({ message: "ABCD1234" })
  })
})

describe("ReferralService.getReferralStatus", () => {
  let repo: ReferralRepository
  let service: ReferralService

  beforeEach(() => {
    repo = makeRepo()
    service = new ReferralService(repo)
    vi.clearAllMocks()
  })

  it("throws UserError for invalid address", async () => {
    vi.mocked(ethers.isAddress).mockReturnValue(false)

    await expect(service.getReferralStatus("not-an-address", logger)).rejects.toThrow(UserError)
  })

  it("returns user status", async () => {
    const status = { hasGeneratedCode: true, hasUsedCode: false, referralCode: "DNIFCJLU", friends: 2 }
    vi.mocked(ethers.isAddress).mockReturnValue(true)
    vi.mocked(repo.getUserStatus).mockResolvedValue(status)

    const result = await service.getReferralStatus(VALID_INPUT.account, logger)

    expect(result).toEqual(status)
  })
})
