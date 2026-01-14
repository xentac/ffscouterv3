import {
  create_info_line,
  inject_info_line,
  wait_for_body,
  wait_for_element,
} from "@utils/dom";
import { ffscouter } from "@utils/ffscouter";
import { generate_info_line } from "@utils/strings";
import type { FFData, PlayerId } from "@utils/types";
import { type Feature, StartTime } from "../feature";

export default {
  name: "Profile FF display",
  description: "Shows FF on top left of any profile page",
  executionTime: StartTime.DocumentStart,

  async shouldRun() {
    // Run on the profile page
    if (window.location.href.startsWith("https://www.torn.com/profiles.php")) {
      return true;
    }
    return false;
  },

  async run() {
    // Extract the player id from the URL
    const match = window.location.href.match(/XID=(\d+)/);
    if (!match || !match[1]) return;

    const player_id: PlayerId = parseInt(match[1], 10);

    // Create container to hold info line
    const info_line = create_info_line();

    // Query ff scouter for FFData
    ffscouter.get(player_id).then(async (data: FFData) => {
      info_line.innerHTML = generate_info_line(data);

      // Figure out where to inject the info line
      const h4 = document.querySelector("h4");

      // The element already exists
      if (!h4) {
        if (!(await wait_for_body(10_000))) {
          return;
        }
        const elem = await wait_for_element("h4", 10_000);
        if (!elem) {
          return;
        }
        inject_info_line(elem, info_line);
      } else {
        inject_info_line(h4, info_line);
      }
    });
    ffscouter.complete();
  },

  httpIntercept: {
    before(_url, _init) {
      // something
      return undefined;
    },

    after(_bodyText, _response, _ctx) {
      // even more things
      return undefined;
    },
  },
} satisfies Feature;
