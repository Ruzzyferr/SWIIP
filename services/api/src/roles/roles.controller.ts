import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService, CreateRoleDto, UpdateRoleDto } from './roles.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GuildPermissionGuard } from '../auth/guards/guild-permission.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/auth.service';
import { Permissions } from '../permissions/permissions.service';

@ApiTags('Roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('guilds/:guildId/roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all roles in a guild' })
  async getRoles(@Param('guildId') guildId: string) {
    return this.rolesService.getRoles(guildId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_ROLES)
  @ApiOperation({ summary: 'Create a role' })
  async create(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRoleDto,
  ) {
    return this.rolesService.create(guildId, user.userId, dto);
  }

  @Patch(':roleId')
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_ROLES)
  @ApiOperation({ summary: 'Update a role' })
  async update(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rolesService.update(roleId, guildId, user.userId, dto);
  }

  @Delete(':roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_ROLES)
  @ApiOperation({ summary: 'Delete a role' })
  async delete(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.rolesService.delete(roleId, guildId, user.userId);
  }

  @Patch()
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_ROLES)
  @ApiOperation({ summary: 'Reorder roles' })
  async reorder(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: { positions: Array<{ id: string; position: number }> },
  ) {
    return this.rolesService.reorder(guildId, user.userId, body.positions);
  }

  @Put(':roleId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_ROLES)
  @ApiOperation({ summary: 'Add role to member' })
  async addMemberRole(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.rolesService.addMemberRole(guildId, memberId, roleId, actor.userId);
  }

  @Delete(':roleId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(GuildPermissionGuard)
  @RequirePermissions(Permissions.MANAGE_ROLES)
  @ApiOperation({ summary: 'Remove role from member' })
  async removeMemberRole(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() actor: AuthUser,
  ) {
    await this.rolesService.removeMemberRole(guildId, memberId, roleId, actor.userId);
  }

  @Get('self-assignable')
  @ApiOperation({ summary: 'Get self-assignable roles in a guild' })
  async getSelfAssignable(@Param('guildId') guildId: string) {
    return this.rolesService.getSelfAssignableRoles(guildId);
  }

  @Put(':roleId/self-assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Self-assign a role' })
  async selfAssign(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.rolesService.selfAssignRole(guildId, user.userId, roleId);
  }

  @Delete(':roleId/self-assign')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a self-assigned role' })
  async selfRemove(
    @Param('guildId') guildId: string,
    @Param('roleId') roleId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.rolesService.selfRemoveRole(guildId, user.userId, roleId);
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Compute effective permissions for current user' })
  async getPermissions(
    @Param('guildId') guildId: string,
    @CurrentUser() user: AuthUser,
    @Query('channelId') channelId?: string,
  ) {
    const permissions = await this.rolesService.computePermissions(user.userId, guildId, channelId);
    return { permissions };
  }
}
