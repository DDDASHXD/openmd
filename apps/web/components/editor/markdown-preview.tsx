'use client'

import React from 'react'
import { useFileContentStore } from '@/stores/file-content.store'

export type MarkdownPreviewProps = {
  path: string
}

export const MarkdownPreview = ({ path }: MarkdownPreviewProps) => {
  const content = useFileContentStore((state) => state.fileContents[path] ?? '')
  const [renderedHtml, setRenderedHtml] = React.useState<string>('')

  React.useEffect(() => {
    const renderMarkdown = async () => {
      const { marked } = await import('marked')
      const html = await marked.parse(content, { gfm: true, breaks: true })
      setRenderedHtml(html)
    }
    renderMarkdown()
  }, [content])

  return (
    <div className="h-full w-full overflow-auto bg-background p-6 font-sans">
      <article
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: renderedHtml }}
        style={{
          lineHeight: '1.6',
        }}
        className="[&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:tracking-tight [&_h1]:mb-4 [&_h1]:mt-2
                   [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:mb-3 [&_h2]:mt-8
                   [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:tracking-tight [&_h3]:mb-3 [&_h3]:mt-6
                   [&_h4]:text-lg [&_h4]:font-semibold [&_h4]:tracking-tight [&_h4]:mb-2 [&_h4]:mt-4
                   [&_h5]:text-base [&_h5]:font-semibold [&_h5]:tracking-tight [&_h5]:mb-2 [&_h5]:mt-4
                   [&_h6]:text-sm [&_h6]:font-semibold [&_h6]:tracking-tight [&_h6]:mb-2 [&_h6]:mt-4 [&_h6]:text-muted-foreground

                   [&_p]:my-4 [&_p]:leading-relaxed

                   [&_ul]:my-4 [&_ul]:pl-6 [&_ul]:list-disc
                   [&_ol]:my-4 [&_ol]:pl-6 [&_ol]:list-decimal
                   [&_li]:my-1 [&_li_p]:my-1 [&_li>ul]:mt-1 [&_li>ol]:mt-1

                   [&_strong]:font-semibold
                   [&_em]:italic
                   [&_s]:line-through [&_del]:line-through

                   [&_a]:text-primary [&_a]:no-underline hover:[&_a]:underline

                   [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-sm [&_code]:font-mono
                   [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:my-4 [&_pre]:overflow-x-auto
                   [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-sm

                   [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground

                   [&_hr]:my-8 [&_hr]:border-t [&_hr]:border-border

                   [&_table]:w-full [&_table]:my-4 [&_table]:border-collapse
                   [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:font-semibold [&_th]:bg-muted [&_th]:text-left
                   [&_td]:border [&_td]:border-border [&_td]:p-2
                   [&_tr]:border-b

                   [&_img]:rounded-lg [&_img]:my-4 [&_img]:max-w-full
                   [&_img]:inline-block

                   [&_input[type='checkbox']]:mr-2

                   max-w-none"
      />
    </div>
  )
}
