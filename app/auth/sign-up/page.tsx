import { SignupForm } from "@/components/signup-form";
import { ThemeToggle } from "@/components/theme-toggle";
import Link from "next/link";
import Image from "next/image";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crea tu cuenta",
  description: "Únete a la plataforma RU Coach de Rodrigo Urbina y comienza tu transformación hoy mismo.",
};

export default async function SignUpPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col gap-4 px-6 pt-[max(1.5rem,calc(env(safe-area-inset-top,0px)+0.75rem))] pb-[max(1.5rem,calc(env(safe-area-inset-bottom,0px)+0.5rem))] safe-area-x md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex size-8 items-center justify-center rounded-md overflow-hidden">
              <Image
                src="/android-chrome-512x512.png"
                alt="Logo RU Coach"
                width={32}
                height={32}
                className="size-full object-contain"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-xl font-black tracking-tighter uppercase">
                RU Coach
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">
                Rodrigo Urbina
              </span>
            </div>
          </Link>
        </div>
        <main id="main-content" className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <SignupForm />
          </div>
        </main>
        <div className="flex justify-center md:justify-start">
          <ThemeToggle />
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block">
        <Image
          src="/img-login.jpg"
          alt="RU Coach Training"
          fill
          priority
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.4] dark:grayscale-[0.2] transition-all duration-500"
          sizes="50vw"
        />
        <div className="absolute inset-0 bg-linear-to-t from-background/80 via-transparent to-transparent lg:from-background/20" />
      </div>
    </div>
  );
}
