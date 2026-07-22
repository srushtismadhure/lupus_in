import classOne from "@/assets/images/class1.png";
import classTwo from "@/assets/images/class2.png";
import classThree from "@/assets/images/class3.png";
import classFour from "@/assets/images/class4.png";

export type LupusNephritisClass = "I" | "II" | "III" | "IV";

const PATHOLOGY_IMAGES: Record<LupusNephritisClass, string> = {
  I: classOne,
  II: classTwo,
  III: classThree,
  IV: classFour,
};

export function resolvePathologyImage(lupusNephritisClass: string | undefined): string | undefined {
  if (!lupusNephritisClass || !(lupusNephritisClass in PATHOLOGY_IMAGES)) return undefined;
  return PATHOLOGY_IMAGES[lupusNephritisClass as LupusNephritisClass];
}
