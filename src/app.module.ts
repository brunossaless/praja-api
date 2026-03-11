import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';
import { SchedulesModule } from './schedules/schedules.module';

@Module({
  imports: [AuthModule, JobsModule, SchedulesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
