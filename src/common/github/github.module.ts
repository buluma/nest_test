import { Module, Global } from '@nestjs/common';
import { GithubAppService } from './github-app.service';
import { GithubClientService } from './github-client.service';

@Global()
@Module({
  providers: [GithubAppService, GithubClientService],
  exports: [GithubAppService, GithubClientService],
})
export class GithubModule {}
