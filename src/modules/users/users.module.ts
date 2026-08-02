import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema';
import { UsersService } from './services/users.service';

/**
 * UsersModule — persistence + core read/create service layer.
 *
 * Per IMPLEMENTATION_PLAN.md M3's note, `UsersService`'s `findByEmail`/
 * `create`/`findById` must exist before Auth's login/register can function,
 * even though the full Users module (profile endpoints, admin management,
 * address CRUD) is scheduled for its own later milestone and is
 * intentionally NOT implemented here.
 *
 * This module has no controller yet and depends on nothing else, keeping
 * it a leaf module per SYSTEM_ARCHITECTURE.md §4.2 ("Users must remain a
 * leaf dependency").
 */
@Module({
  imports: [MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
