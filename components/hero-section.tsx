import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TextEffect } from "@/components/motion-primitives/text-effect";
import { AnimatedGroup } from "@/components/motion-primitives/animated-group";
import DecryptedText from "@/components/DecryptedText";
import { transitionVariants } from "@/lib/utils";
import LanyardWithControls from "@/components/lanyard-with-controls";

export default function HeroSection() {
    return (
        <main className="overflow-x-hidden">
            <section className='lg:h-screen relative'>
                <div
                    className="pb-24 pt-12 md:pb-32 lg:pb-56 lg:pt-44 lg:grid lg:grid-cols-2 lg:grid-rows-1 grid-cols-1 grid-rows-2">
                    <div className="relative mx-auto flex max-w-xl flex-col px-6 lg:block">
                        <div className="mx-auto max-w-2xl text-center lg:ml-0 lg:text-left">
                            <div className='mt-8 lg:mt-16'>
                                <DecryptedText
                                    text="STUDENT PROBLEMS. REAL COMPANIES. AI-RANKED."
                                    animateOn="view"
                                    revealDirection="start"
                                    sequential
                                    useOriginalCharsOnly={false}
                                    speed={70}
                                    className='font-mono text-muted-foreground bg-black rounded-md uppercase'
                                />
                            </div>
                            <TextEffect
                                preset="fade-in-blur"
                                speedSegment={0.3}
                                as="h1"
                                className="max-w-2xl text-balance text-6xl font-semibold md:text-7xl xl:text-8xl font-display">
                                Solve.
                            </TextEffect>
                            <TextEffect
                                preset="fade-in-blur"
                                speedSegment={0.3}
                                as="h1"
                                className="max-w-2xl text-balance text-6xl font-semibold md:text-7xl xl:text-8xl font-display">
                                Get Ranked. Get Hired.
                            </TextEffect>
                            <TextEffect
                                per="line"
                                preset="fade-in-blur"
                                speedSegment={0.3}
                                delay={0.5}
                                as="p"
                                className="mt-8 max-w-2xl text-pretty text-lg text-muted-foreground bg-black/60 p-1 rounded-md">
                                Work on genuine business challenges posted directly by hiring managers. Get scored by AI and sent straight to hiring teams.
                            </TextEffect>
                            <AnimatedGroup
                                variants={{
                                    container: {
                                        visible: {
                                            transition: {
                                                staggerChildren: 0.05,
                                                delayChildren: 0.75,
                                            },
                                        },
                                    },
                                    ...transitionVariants,
                                }}
                                className="mt-12 flex flex-col items-center justify-center gap-2 sm:flex-row lg:justify-start"
                            >
                                <Button
                                    asChild
                                    size="lg"
                                    className="px-6 text-base bg-white text-black hover:bg-zinc-200 font-medium">
                                    <Link href="/signup">
                                        <span className="text-nowrap">Sign Up</span>
                                    </Link>
                                </Button>
                                <Button
                                    key={2}
                                    asChild
                                    size="lg"
                                    variant="ghost"
                                    className="px-6 text-base bg-black/40 border border-white/10 backdrop-blur-sm hover:bg-black/60 text-white">
                                    <Link href="#why-tacet">
                                        <span className="text-nowrap">Learn More</span>
                                    </Link>
                                </Button>
                            </AnimatedGroup>
                        </div>
                    </div>
                    <LanyardWithControls
                        position={[0, 0, 20]}
                        containerClassName='lg:absolute lg:top-0 lg:right-0 lg:w-1/2 relative w-full h-screen bg-radial lg:from-transparent lg:to-transparent from-muted to-background select-none'
                        defaultName="" />
                </div>
            </section>
        </main>
    )
}
