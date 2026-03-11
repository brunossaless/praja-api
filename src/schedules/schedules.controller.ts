import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ScheduleStatus } from '@prisma/client';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateScheduleDto, UpdateScheduleDto } from './schedules.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(
    @Req() req: Request & { user: { sub: number } },
    @Body() body: CreateScheduleDto,
  ) {
    return this.schedulesService.create(body, req.user.sub);
  }

  @Get('requests')
  @UseGuards(JwtAuthGuard)
  findAllRequests(
    @Req() req: Request & { user: { sub: number } },
    @Query('status', new ParseEnumPipe(ScheduleStatus, { optional: true }))
    status?: ScheduleStatus,
  ) {
    return this.schedulesService.findAllRequests(req.user.sub, status);
  }

  @Get('received')
  @UseGuards(JwtAuthGuard)
  findAllReceived(
    @Req() req: Request & { user: { sub: number } },
    @Query('status', new ParseEnumPipe(ScheduleStatus, { optional: true }))
    status?: ScheduleStatus,
  ) {
    return this.schedulesService.findAllReceived(req.user.sub, status);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findById(
    @Req() req: Request & { user: { sub: number } },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.schedulesService.findById(id, req.user.sub);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.schedulesService.remove(id);
  }
}
