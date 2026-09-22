import {Card, CardContent, CardHeader} from '@/components/ui/card'
import {BriefcaseIcon, BrainCircuitIcon, SendIcon} from 'lucide-react'
import React, {ReactNode} from 'react'
import {TextEffect} from "@/components/motion-primitives/text-effect";
import {transitionVariants} from "@/lib/utils";
import {AnimatedGroup} from "@/components/motion-primitives/animated-group";

export default function Features() {
    return (
        <section id="why-tacet" className="py-16 md:py-32 dark:bg-transparent bg-transparent">
            <div className="@container mx-auto max-w-5xl px-6">
                <div className="text-center">
                    <TextEffect
                        triggerOnView
                        preset="fade-in-blur"
                        speedSegment={0.3}
                        as="h2"
                        className="text-balance text-4xl font-semibold lg:text-5xl">
                        Why TACET
                    </TextEffect>
                </div>
                <AnimatedGroup
                    triggerOnView
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
                >
                    <Card
                        className="@min-4xl:max-w-full @min-4xl:grid-cols-3 @min-4xl:divide-x @min-4xl:divide-y-0 mx-auto mt-8 grid max-w-sm divide-y overflow-hidden shadow-zinc-950/5 *:text-center md:mt-16">
                        <div className="group shadow-zinc-950/5">
                            <CardHeader className="pb-3">
                                <CardDecorator>
                                    <BriefcaseIcon
                                        className="size-6"
                                        aria-hidden
                                    />
                                </CardDecorator>

                                <h3 className="mt-6 font-medium text-xl">Real Company Problems</h3>
                            </CardHeader>

                            <CardContent>
                                <p className="text-sm text-muted-foreground">Work on genuine business challenges posted directly by hiring managers, not hypothetical case studies.</p>
                            </CardContent>
                        </div>

                        <div className="group shadow-zinc-950/5">
                            <CardHeader className="pb-3">
                                <CardDecorator>
                                    <BrainCircuitIcon
                                        className="size-6"
                                        aria-hidden
                                    />
                                </CardDecorator>

                                <h3 className="mt-6 font-medium text-xl">AI-Powered Ranking</h3>
                            </CardHeader>

                            <CardContent>
                                <p className="mt-3 text-sm text-muted-foreground">Every submission is scored by a multi-agent AI panel on technical quality, business impact, and originality before a human ever sees it.</p>
                            </CardContent>
                        </div>

                        <div className="group shadow-zinc-950/5">
                            <CardHeader className="pb-3">
                                <CardDecorator>
                                    <SendIcon
                                        className="size-6"
                                        aria-hidden
                                    />
                                </CardDecorator>

                                <h3 className="mt-6 font-medium text-xl">Direct to Hiring Teams</h3>
                            </CardHeader>

                            <CardContent>
                                <p className="mt-3 text-sm text-muted-foreground">Top-ranked submissions go straight to the company's hiring team — no resume screen, no generic application queue.</p>
                            </CardContent>
                        </div>
                    </Card>
                </AnimatedGroup>
            </div>
        </section>
    )
}

const CardDecorator = ({children}: { children: ReactNode }) => (
    <div
        className="mask-radial-from-40% mask-radial-to-60% relative mx-auto size-36 duration-200 [--color-border:color-mix(in_oklab,var(--color-zinc-950)10%,transparent)] group-hover:[--color-border:color-mix(in_oklab,var(--color-zinc-950)20%,transparent)] dark:[--color-border:color-mix(in_oklab,var(--color-white)15%,transparent)] dark:group-hover:[--color-border:color-mix(in_oklab,var(--color-white)20%,transparent)]">
        <div
            aria-hidden
            className="absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-size-[24px_24px] dark:opacity-50"
        />

        <div
            className="bg-background absolute inset-0 m-auto flex size-12 items-center justify-center border-l border-t">{children}</div>
    </div>
)
