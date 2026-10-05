import type { Metadata } from "next";
import { Showcase } from "@/components/Showcase";

export const metadata: Metadata = {
  title: "City of Ownership",
  description: "A stock portfolio, drawn as a city — height is money invested, lit windows are profit.",
};

export default function Page() {
  return <Showcase />;
}
