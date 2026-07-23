"use client";

import { useEffect } from "react";
import { seedLocalStorage } from "@/utils/seedData";

// Runs once on the client to populate localStorage with mock data.
// Renders nothing - it's a side-effect-only component.
export default function SeedInitializer() {
  useEffect(() => {
    seedLocalStorage();
  }, []);

  return null;
}
