import type { Metadata } from "next";
import { MyPractice } from "@/components/my-practice";

export const metadata: Metadata = {
  title: "My practice",
  description: "Your recent ExamReady tests and results on this device.",
  robots: { index: false, follow: true },
};

export default function MyPracticePage() {
  return (
    <div className="container-page py-8 sm:py-12">
      <h1 className="text-[2.2rem] sm:text-[2.8rem]">My practice</h1>
      <p className="prose-width mt-3 text-[1.08rem] text-pencil">
        Tests you have submitted on this device. Student accounts, which will keep your history across devices, are coming later.
      </p>
      <MyPractice />
    </div>
  );
}
