import type { FFData, TimestampSec } from "./types";

const HOUR = 60 * 60;
const DAY = HOUR * 24;

const OLD_ESTIMATE_INTERVAL = 14 * DAY; // sec

export function generate_info_line(data: FFData) {
  if (data.no_data) {
    return `<span style="font-weight: bold; margin-right: 6px;">FairFight:</span><span style="background: #444; color: #fff; font-weight: bold; padding: 2px 6px; border-radius: 4px; display: inline-block;">No data</span>`;
  }
  const ff_string = format_ff_score(data);
  const difficulty = format_difficulty_text(data);

  const fresh = format_relative_time(data);

  const background_colour = get_ff_colour(data);
  const text_colour = get_contrast_color(background_colour);

  let statDetails = "";
  statDetails = `<span style="font-size: 11px; font-weight: normal; margin-left: 8px; vertical-align: middle; font-style: italic;">Est. Stats: <span>${data.bs_estimate_human}</span></span>`;

  return `<span style="font-weight: bold; margin-right: 6px;">FairFight:</span><span style="background: ${background_colour}; color: ${text_colour}; font-weight: bold; padding: 2px 6px; border-radius: 4px; display: inline-block;">${ff_string} (${difficulty}) ${fresh}</span>${statDetails}`;
}

export function format_ff_score(d: FFData) {
  if (d.no_data) {
    return "Unknown";
  }
  const ff = d.fair_fight.toFixed(2);

  const now: TimestampSec = Date.now() / 1000;
  const age = now - d.last_updated;

  var suffix = "";
  if (age > OLD_ESTIMATE_INTERVAL) {
    suffix = "?";
  }

  return `${ff}${suffix}`;
}

export function format_difficulty_text(d: FFData) {
  if (d.no_data) {
    return "";
  }
  if (d.fair_fight <= 1) {
    return "Extremely easy";
  } else if (d.fair_fight <= 2) {
    return "Easy";
  } else if (d.fair_fight <= 3.5) {
    return "Moderately difficult";
  } else if (d.fair_fight <= 4.5) {
    return "Difficult";
  } else {
    return "May be impossible";
  }
}

export function format_relative_time(d: FFData) {
  if (d.no_data) {
    return "";
  }
  const age = Date.now() / 1000 - d.last_updated;
  if (age < DAY) {
    return "";
  } else if (age < 31 * DAY) {
    const days = Math.round(age / DAY);
    if (days === 1) {
      return "(1 day old)";
    } else {
      return `(${days} days old)`;
    }
  } else if (age < 365 * DAY) {
    const months = Math.round(age / (31 * DAY));
    if (months === 1) {
      return "(1 month old)";
    } else {
      return `(${months} months old)`;
    }
  } else {
    const years = Math.round(age / (365 * DAY));
    if (years === 1) {
      return "(1 year old)";
    } else {
      return `(${years} years old)`;
    }
  }
}

function rgb_to_hex(r: number, g: number, b: number) {
  return (
    "#" +
    ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()
  ); // Convert to hex and return
}

export function get_ff_colour(d: FFData) {
  if (d.no_data) {
    return "#000000";
  }
  let r: number, g: number, b: number;

  // Transition from
  // blue - #2828c6
  // to
  // green - #28c628
  // to
  // red - #c62828
  if (d.fair_fight <= 1) {
    // Blue
    r = 0x28;
    g = 0x28;
    b = 0xc6;
  } else if (d.fair_fight <= 3) {
    // Transition from blue to green
    const t = (d.fair_fight - 1) / 2; // Normalize to range [0, 1]
    r = 0x28;
    g = Math.round(0x28 + (0xc6 - 0x28) * t);
    b = Math.round(0xc6 - (0xc6 - 0x28) * t);
  } else if (d.fair_fight <= 5) {
    // Transition from green to red
    const t = (d.fair_fight - 3) / 2; // Normalize to range [0, 1]
    r = Math.round(0x28 + (0xc6 - 0x28) * t);
    g = Math.round(0xc6 - (0xc6 - 0x28) * t);
    b = 0x28;
  } else {
    // Red
    r = 0xc6;
    g = 0x28;
    b = 0x28;
  }

  return rgb_to_hex(r, g, b); // Return hex value
}

export function get_contrast_color(hex: string) {
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Calculate brightness
  const brightness = r * 0.299 + g * 0.587 + b * 0.114;
  return brightness > 126 ? "black" : "white"; // Return black or white based on brightness
}
