import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { GithubModule } from './common/github/github.module';
import { PollerModule } from './modules/poller.module';
import { ApiModule } from './modules/api.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    GithubModule,
    PollerModule,
    ApiModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
