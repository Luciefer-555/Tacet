import Link from 'next/link'
import React from "react"
import Logo from '@/components/logo'

export default function FooterSection() {
    return (
        <footer className="py-16 md:py-32">
            <div className="mx-auto max-w-5xl px-6 text-center">
                <Link
                    href="/"
                    aria-label="TACET home"
                    className="mx-auto flex items-center justify-center gap-2 size-fit text-xl font-bold tracking-tight text-foreground">
                    <Logo size={24} decorative className="text-foreground" />
                    <span className="font-display">TACET</span>
                </Link>

                <span className="text-muted-foreground mt-8 block text-sm">
                    &copy; {new Date().getFullYear()} Tacet. All rights reserved.
                </span>
            </div>
        </footer>
    )
}
