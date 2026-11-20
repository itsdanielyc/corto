/** Option lists shared by the inspector tiles, film tools and settings. */
export const MOTION_CHOICES = [
  ["none", "Still"],
  ["zoom-in", "Slow zoom in"],
  ["zoom-out", "Slow zoom out"],
  ["pan-left", "Pan left"],
  ["pan-right", "Pan right"],
  ["pan-up", "Pan up"],
  ["pan-down", "Pan down"],
  ["custom", "Your framing"],
] as const;
export const TRANSITION_CHOICES = [
  ["cut", "Straight cut"],
  ["fade", "Fade through black"],
  ["dissolve", "Cross dissolve"],
  ["fade-white", "Fade through white"],
  ["wipe-left", "Wipe left"],
  ["wipe-right", "Wipe right"],
  ["slide-left", "Slide left"],
  ["slide-right", "Slide right"],
  ["push-up", "Push up"],
  ["zoom", "Gentle zoom"],
  ["blur", "Soft blur"],
] as const;
