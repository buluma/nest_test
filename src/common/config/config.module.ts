import { Module, Global } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { githubConfig } from './github.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [githubConfig],
      envFilePath: '.env',
      validate: (config) => {
        // Validation happens in githubConfig factory
        return config;
      },
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
