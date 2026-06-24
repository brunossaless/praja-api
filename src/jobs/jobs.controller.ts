import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateJobDto, UpdateJobDto } from './jobs.dto';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  create(@Body() body: CreateJobDto) {
    return this.jobsService.create(body);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('forWomen', new ParseBoolPipe({ optional: true }))
    forWomen?: boolean,
  ) {
    return this.jobsService.findAll(forWomen);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.findById(id);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateJobDto) {
    return this.jobsService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.jobsService.remove(id);
  }
}
