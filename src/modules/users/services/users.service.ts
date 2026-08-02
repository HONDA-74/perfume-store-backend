import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Role } from '../../../common/types/enums/role.enum';
import { User, UserDocument } from '../schemas/user.schema';

export interface CreateUserInput {
  fullName: string;
  email: string;
  passwordHash: string;
}

/**
 * Core read/create methods needed by Auth (findByEmail/create/findById),
 * per SYSTEM_ARCHITECTURE.md §4.2 and IMPLEMENTATION_PLAN.md M3's note that
 * these must exist before Auth's login/register can function. Profile
 * management, admin listing, and address CRUD (the rest of the Users
 * module) are out of scope for this phase — Auth is the only consumer here.
 */
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly userModel: Model<UserDocument>) {}

  async findByEmail(email: string, withPasswordHash = false): Promise<UserDocument | null> {
    const query = this.userModel.findOne({
      email: email.toLowerCase().trim(),
      isDeleted: false,
    });

    if (withPasswordHash) {
      query.select('+passwordHash');
    }

    return query.exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ _id: id, isDeleted: false }).exec();
  }

  /**
   * Creates a CUSTOMER account. `role` is intentionally absent from
   * `CreateUserInput` — it is structurally impossible for any caller
   * (including AuthService) to pass a role through this method, enforcing
   * API_BLUEPRINT.md §2 ("no role field accepted from the client").
   */
  async create(input: CreateUserInput): Promise<UserDocument> {
    const created = new this.userModel({
      fullName: input.fullName,
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      role: Role.CUSTOMER,
    });

    return created.save();
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userModel.updateOne({ _id: id }, { $set: { lastLoginAt: new Date() } }).exec();
  }
}
