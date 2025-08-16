import {multiUserTest} from '../../fixtures';
import {setupConsoleErrorReporting, setupMCPDebugOnFailure} from '../../helpers';
import {GroupWorkflow, MultiUserWorkflow} from '../../workflows';
import {generateShortId} from '../../utils/test-helpers';

setupConsoleErrorReporting();
setupMCPDebugOnFailure();

// NOTE: Network resilience tests for share links have been removed as they test
// incomplete features that cause flaky behavior due to authentication/network interactions