import { isAddress } from "viem"
import { UserRepository } from "../data/user.data.js"

export class UserService {
  userRepository: UserRepository

  constructor(userRepo: UserRepository) {
    this.userRepository = userRepo
  }

  async registerAddress(address: string) {
    if (!isAddress(address)) {
      throw Object.assign(new Error("Invalid address"), { statusCode: 400 })
    }

    return this.userRepository.upsertByAddress(address)
  }
}
