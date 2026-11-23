import { Logger } from '@nestjs/common';

// Keep unit test output readable; assertions cover behaviour, not log lines.
Logger.overrideLogger(false);
