import { Features } from '@features/index';
import logger from '@utils/logger';
import { setHttpInterceptor } from '@utils/network';

const INJECTION_KEY = '__FF_SCOUTER_V3_INJECTED__';

async function main() {
  const w = window as unknown as Record<string, boolean>;
  if (w[INJECTION_KEY]) {
    logger.info('Script already injected');
    return;
  }
  w[INJECTION_KEY] = true;

  // TODO: Add version code here
  logger.info('Initializing');

  // todo: settings panel

  // loop over features, check if enabled, see if we need to wait for document ready

  // this needs to be redone as we lose the ability to change url in before & resp in after
  setHttpInterceptor({
    // also a check if the feature's active and it has before / after set up
    // (unsure why this doesn't throw an error btw)
    before(url, init) {
      for (const feat of Features) {
        feat.httpIntercept.before(url, init);
      }

      return undefined;
    },

    after(bodyText, response, ctx) {
      for (const feat of Features) {
        feat.httpIntercept.after(bodyText, response, ctx);
      }

      return undefined;
    },
  });

  // todo: filter into 2 categories, documentend and documentstart, blah blah
  for (const feat of Features) {
    // + check if feature is toggled
    if (await feat.shouldRun()) feat.run();
  }
}

main();
