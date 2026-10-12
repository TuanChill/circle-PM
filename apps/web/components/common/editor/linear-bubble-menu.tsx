'use client';

import * as React from 'react';
import { Editor } from '@tiptap/react';
import {
   Bold,
   CheckSquare,
   Code,
   Heading1,
   Heading2,
   Heading3,
   Italic,
   Link as LinkIcon,
   List,
   ListOrdered,
   Strikethrough,
   Underline,
   Unlink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinearBubbleMenuProps {
   editor: Editor | null;
}

export function LinearBubbleMenu({ editor }: LinearBubbleMenuProps) {
   const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
   const [isLinkPromptOpen, setIsLinkPromptOpen] = React.useState(false);
   const [linkUrl, setLinkUrl] = React.useState('');
   const linkInputRef = React.useRef<HTMLInputElement>(null);

   const updatePosition = React.useCallback(() => {
      if (!editor || editor.isDestroyed || !editor.isFocused) {
         setPosition(null);
         setIsLinkPromptOpen(false);
         return;
      }

      const { selection } = editor.state;
      if (selection.empty) {
         setPosition(null);
         setIsLinkPromptOpen(false);
         return;
      }

      // Check if text is selected
      const { ranges } = selection;
      const from = Math.min(...ranges.map((range) => range.$from.pos));
      const to = Math.max(...ranges.map((range) => range.$to.pos));
      if (from === to) {
         setPosition(null);
         setIsLinkPromptOpen(false);
         return;
      }

      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) {
         setPosition(null);
         return;
      }

      const range = domSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) {
         setPosition(null);
         return;
      }

      const menuWidth = 420;
      const top = Math.max(10, rect.top - 44);
      const left = Math.max(
         12,
         Math.min(rect.left + rect.width / 2 - menuWidth / 2, window.innerWidth - menuWidth - 16)
      );

      setPosition({ top, left });
   }, [editor]);

   React.useEffect(() => {
      if (!editor) return;

      const onUpdate = () => updatePosition();
      editor.on('selectionUpdate', onUpdate);
      editor.on('transaction', onUpdate);
      editor.on('blur', onUpdate);

      window.addEventListener('resize', onUpdate);
      window.addEventListener('scroll', onUpdate, true);

      return () => {
         editor.off('selectionUpdate', onUpdate);
         editor.off('transaction', onUpdate);
         editor.off('blur', onUpdate);
         window.removeEventListener('resize', onUpdate);
         window.removeEventListener('scroll', onUpdate, true);
      };
   }, [editor, updatePosition]);

   React.useEffect(() => {
      if (isLinkPromptOpen) {
         linkInputRef.current?.focus();
      }
   }, [isLinkPromptOpen]);

   if (!editor || !position) {
      return null;
   }

   const handleSetLink = (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = linkUrl.trim();
      if (!trimmed) {
         editor.chain().focus().unsetLink().run();
      } else {
         editor.chain().focus().setLink({ href: trimmed }).run();
      }
      setIsLinkPromptOpen(false);
      setLinkUrl('');
   };

   return (
      <div
         style={{ top: `${position.top}px`, left: `${position.left}px` }}
         className="fixed z-50 flex max-w-[calc(100vw-24px)] flex-wrap items-center gap-0.5 rounded-lg border border-border/80 bg-popover/95 p-1 text-popover-foreground shadow-xl backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-100 select-none"
         onMouseDown={(event) => {
            // Formatting should not blur the editor before the button's action runs.
            if ((event.target as HTMLElement).closest('button')) {
               event.preventDefault();
            }
         }}
      >
         {isLinkPromptOpen ? (
            <form onSubmit={handleSetLink} className="flex items-center gap-1 px-1">
               <input
                  ref={linkInputRef}
                  type="text"
                  placeholder="Paste or type URL..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => {
                     if (e.key === 'Escape') {
                        setIsLinkPromptOpen(false);
                     }
                  }}
                  className="h-6 w-48 rounded bg-background px-2 text-xs text-foreground outline-none border border-border/60"
               />
               <button
                  type="submit"
                  className="h-6 rounded bg-primary px-2 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
               >
                  Save
               </button>
            </form>
         ) : (
            <>
               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('bold')
                        ? 'bg-accent text-accent-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Bold"
               >
                  <Bold className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('italic')
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Italic"
               >
                  <Italic className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('strike')
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Strikethrough"
               >
                  <Strikethrough className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('underline')
                        ? 'bg-accent text-accent-foreground underline'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Underline"
               >
                  <Underline className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('code')
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Inline code"
               >
                  <Code className="size-3.5" />
               </button>

               <div className="mx-0.5 h-4 w-px bg-border/60" />

               <button
                  type="button"
                  onClick={() => {
                     const previousUrl = editor.getAttributes('link').href || '';
                     setLinkUrl(previousUrl);
                     setIsLinkPromptOpen(true);
                  }}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('link')
                        ? 'bg-accent text-primary'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Link"
               >
                  <LinkIcon className="size-3.5" />
               </button>

               {editor.isActive('link') && (
                  <button
                     type="button"
                     onClick={() => editor.chain().focus().unsetLink().run()}
                     className="flex size-7 items-center justify-center rounded hover:bg-accent text-destructive hover:text-destructive"
                     title="Remove link"
                  >
                     <Unlink className="size-3.5" />
                  </button>
               )}

               <div className="mx-0.5 h-4 w-px bg-border/60" />

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors text-xs font-semibold',
                     editor.isActive('heading', { level: 1 })
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Heading 1"
               >
                  <Heading1 className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors text-xs font-semibold',
                     editor.isActive('heading', { level: 2 })
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Heading 2"
               >
                  <Heading2 className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors text-xs font-semibold',
                     editor.isActive('heading', { level: 3 })
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Heading 3"
               >
                  <Heading3 className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('taskList')
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Task list"
               >
                  <CheckSquare className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('bulletList')
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Bullet list"
               >
                  <List className="size-3.5" />
               </button>

               <button
                  type="button"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={cn(
                     'flex size-7 items-center justify-center rounded hover:bg-accent transition-colors',
                     editor.isActive('orderedList')
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Numbered list"
               >
                  <ListOrdered className="size-3.5" />
               </button>
            </>
         )}
      </div>
   );
}
