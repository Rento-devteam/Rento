import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt-auth.guard';
import { AddCardDto } from './dto/add-card.dto';
import { PaymentMethodsService } from './payment-methods.service';

@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
  }),
)
@Controller()
export class PaymentMethodsController {
  constructor(private readonly paymentMethodsService: PaymentMethodsService) {}

  @Get('payment/methods')
  listMethods(@Req() request: RequestWithUser) {
    return this.paymentMethodsService.listMethods(this.getUserId(request));
  }

  @Post('payment/cards/add')
  @HttpCode(HttpStatus.CREATED)
  addCard(@Req() request: RequestWithUser, @Body() dto: AddCardDto) {
    return this.paymentMethodsService.addCard(this.getUserId(request), dto);
  }

  @Patch('payment/cards/:cardId/default')
  @HttpCode(HttpStatus.OK)
  setDefault(
    @Req() request: RequestWithUser,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ) {
    return this.paymentMethodsService.setDefault(
      this.getUserId(request),
      cardId,
    );
  }

  @Delete('payment/cards/:cardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeCard(
    @Req() request: RequestWithUser,
    @Param('cardId', ParseUUIDPipe) cardId: string,
  ) {
    return this.paymentMethodsService.removeCard(
      this.getUserId(request),
      cardId,
    );
  }

  private getUserId(request: RequestWithUser): string {
    const userId = request.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('Missing user');
    }
    return userId;
  }
}
