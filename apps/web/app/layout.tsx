import { Geist, Geist_Mono } from 'next/font/google'

import '@workspace/ui/globals.css'
import { DesktopBootstrap } from '@/components/desktop-bootstrap'
import { MenuOverlays } from '@/components/menu-overlays'
import { NativeMenuListener } from '@/components/native-menu-listener'
import { ThemeProvider } from '@/components/theme-provider'
import { CommandPaletteProvider } from '@/hooks/use-command-palette'
import { SettingsProvider } from '@/components/settings-provider'
import { cn } from '@workspace/ui/lib/utils'

const fontSans = Geist({
  subsets: ['latin'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        'antialiased',
        fontSans.variable,
        'font-mono',
        geistMono.variable,
        'bg-secondary',
      )}
    >
      <body>
        <ThemeProvider>
          <SettingsProvider>
            <CommandPaletteProvider>
              <DesktopBootstrap />
              <NativeMenuListener />
              {children}
              <MenuOverlays />
            </CommandPaletteProvider>
          </SettingsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
