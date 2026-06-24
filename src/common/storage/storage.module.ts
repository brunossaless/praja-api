import { Module } from '@nestjs/common';
import { LocalStorageService } from './local-storage.service';
import { StorageService } from './storage.service';
import { SupabaseStorageService } from './supabase-storage.service';

// Use Supabase Storage when configured; otherwise fall back to local disk (dev).
const useSupabase = Boolean(
  process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

@Module({
  providers: [
    {
      provide: StorageService,
      useClass: useSupabase ? SupabaseStorageService : LocalStorageService,
    },
  ],
  exports: [StorageService],
})
export class StorageModule {}
