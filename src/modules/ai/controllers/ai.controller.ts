import { Body, Controller, Post, Req, Sse, MessageEvent } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/types/enums/role.enum';
import { ChatRequestDto } from '../dto/chat-request.dto';
import { ChatResponseDto } from '../dto/chat-response.dto';
import { RecommendationService } from '../services/recommendation.service';

const THROTTLE_AI_LIMIT = parseInt(process.env.THROTTLE_AI_LIMIT ?? '5', 10);
const THROTTLE_AI_TTL = parseInt(process.env.THROTTLE_AI_TTL ?? '60', 10);

/**
 * AI Recommendation endpoint (IMPLEMENTATION_PLAN.md M11). Customer-only,
 * mirroring the Cart/Wishlist auth posture. Relies on the globally
 * registered JwtAuthGuard → RolesGuard chain (default deny, AI_RULES.md
 * §23) plus an explicit @Roles(Role.CUSTOMER) annotation.
 */
@ApiTags('AI Recommendations')
@ApiBearerAuth('access-token')
@Controller('ai')
@Roles(Role.CUSTOMER)
@Throttle({ default: { limit: THROTTLE_AI_LIMIT, ttl: THROTTLE_AI_TTL * 1000 } })
export class AiController {
  constructor(private readonly recommendationService: RecommendationService) {}

  @Post('chat')
  @ApiOperation({ summary: 'Ask the AI fragrance consultant for a recommendation' })
  @ApiOkResponse({
    description: 'Assistant reply with grounded product recommendations.',
    type: ChatResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  chat(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
  ): Promise<ChatResponseDto> {
    return this.recommendationService.chat(userId, dto, req.requestId);
  }

  @Post('chat/stream')
  @Sse('chat/stream')
  @ApiOperation({ summary: 'Ask the AI fragrance consultant for a recommendation (streaming)' })
  @ApiOkResponse({
    description: 'Server-Sent Events streaming the Gemini response token-by-token.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' })
  chatStream(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChatRequestDto,
    @Req() req: Request,
  ): Promise<Observable<MessageEvent>> {
    return this.recommendationService.chatStream(userId, dto, req.requestId);
  }
}
