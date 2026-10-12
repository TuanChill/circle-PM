'use client';

import * as React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Markdown } from 'tiptap-markdown';
import { cn } from '@/lib/utils';
import { createSlashCommandExtension, SlashCommandState } from './slash-command';
import { SlashCommandMenu } from './slash-command-menu';
import { LinearBubbleMenu } from './linear-bubble-menu';

export interface LinearEditorProps {
   value?: string;
   onChange?: (markdown: string) => void;
   onBlur?: (markdown: string) => void;
   onSave?: (markdown: string) => void;
   /** Keep content read-only until the user clicks it, like Linear's issue editor. */
   mode?: 'always' | 'click-to-edit';
   autoSaveDelay?: number;
   placeholder?: string;
   editable?: boolean;
   autoFocus?: boolean;
   className?: string;
   minHeight?: string;
}

export function LinearEditor({
   value = '',
   onChange,
   onBlur,
   onSave,
   mode = 'always',
   autoSaveDelay = 1000,
   placeholder = "Add description or type '/' for commands...",
   editable = true,
   autoFocus = false,
   className,
   minHeight = 'min-h-[70px]',
}: LinearEditorProps) {
   const [isMounted, setIsMounted] = React.useState(false);
   const [isEditing, setIsEditing] = React.useState(mode === 'always' && editable);
   const [slashState, setSlashState] = React.useState<SlashCommandState>({
      isOpen: false,
      query: '',
      range: null,
      clientRect: null,
      command: null,
   });

   const onKeyDownRef = React.useRef<((event: KeyboardEvent) => boolean) | null>(null);
   const lastReportedValue = React.useRef<string>(value);
   const lastSavedValue = React.useRef<string>(value);
   const lastExternalValue = React.useRef<string>(value);
   const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
   const isClickToEdit = mode === 'click-to-edit';
   const editorIsEditable = editable && (!isClickToEdit || isEditing);

   const triggerSave = React.useCallback(
      (md: string) => {
         if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
            saveTimeoutRef.current = null;
         }
         if (md !== lastSavedValue.current) {
            lastSavedValue.current = md;
            onSave?.(md);
         }
      },
      [onSave]
   );

   const scheduleSave = React.useCallback(
      (md: string) => {
         if (!onSave) return;
         if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
         }
         saveTimeoutRef.current = setTimeout(() => {
            triggerSave(md);
         }, autoSaveDelay);
      },
      [onSave, triggerSave, autoSaveDelay]
   );

   React.useEffect(() => {
      return () => {
         if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
         }
      };
   }, []);

   React.useEffect(() => {
      setIsMounted(true);
   }, []);

   const slashCommandExt = React.useMemo(() => {
      return createSlashCommandExtension(setSlashState, onKeyDownRef);
   }, []);

   // Keep one ProseMirror instance for the lifetime of this component. The save
   // callbacks are refreshed through Tiptap's latest options, but putting them
   // in the dependency array would destroy/recreate the editor whenever the
   // mutation or activity query changes state, which drops the caret/focus.
   const editor = useEditor({
      extensions: [
         StarterKit.configure({
            // StarterKit 3.x includes both extensions; configure them here so
            // the custom instances below are the only registered link/underline
            // extensions and Tiptap does not emit duplicate-name warnings.
            link: false,
            underline: false,
            heading: {
               levels: [1, 2, 3, 4],
            },
            codeBlock: {
               HTMLAttributes: {
                  class: 'rounded-lg border border-border/60 bg-muted/40 p-4 font-mono text-[13px] leading-6',
               },
            },
         }),
         Placeholder.configure({
            placeholder,
            emptyEditorClass: 'is-editor-empty',
         }),
         TaskList.configure({
            HTMLAttributes: {
               class: 'taskList',
            },
         }),
         TaskItem.configure({
            nested: true,
            HTMLAttributes: {
               class: 'taskItem',
            },
         }),
         Link.configure({
            openOnClick: false,
            autolink: true,
            HTMLAttributes: {
               class: 'text-primary underline underline-offset-4 cursor-pointer hover:text-primary/80',
            },
         }),
         Underline,
         Markdown.configure({
            html: true,
            tightLists: true,
            bulletListMarker: '-',
         }),
         slashCommandExt,
      ],
      content: value,
      editable: editorIsEditable,
      autofocus: autoFocus ? 'end' : false,
      editorProps: {
         attributes: {
            class: cn('focus:outline-none w-full text-[15px] leading-7 text-foreground', minHeight),
         },
         handleKeyDown: (view, event) => {
            // Let slash command handle keydown first if open
            if (slashState.isOpen && onKeyDownRef.current) {
               const handled = onKeyDownRef.current(event);
               if (handled) return true;
            }

            // Escape key blurs editor when menu is closed
            if (event.key === 'Escape' && !slashState.isOpen) {
               event.preventDefault();
               view.dom.blur();
               return true;
            }

            return false;
         },
      },
      onUpdate: ({ editor: ed }) => {
         const md =
            (ed.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ??
            '';
         lastReportedValue.current = md;
         onChange?.(md);
         scheduleSave(md);
      },
      onCreate: ({ editor: ed }) => {
         // Tiptap can normalize legacy Markdown on initialization. Treat that
         // canonical form as the saved baseline so merely entering edit mode
         // never creates a description-change event.
         const md =
            (ed.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ??
            '';
         lastReportedValue.current = md;
         lastSavedValue.current = md;
         lastExternalValue.current = value;
      },
      onBlur: ({ editor: ed }) => {
         const md =
            (ed.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ??
            '';
         lastReportedValue.current = md;
         onBlur?.(md);
         triggerSave(md);
         if (isClickToEdit) {
            setIsEditing(false);
         }
      },
   });

   // Sync value if changed from outside
   React.useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      if (value === lastExternalValue.current) return;

      // Background issue/activity refetches can update the prop while the user
      // is typing. Never replace the document in that window: setContent resets
      // the selection and makes the editor lose focus. Re-check when editing
      // ends so genuine external changes still reach the read-only view.
      if (editor.isFocused || (isClickToEdit && isEditing)) {
         return;
      }

      lastExternalValue.current = value;
      const currentMarkdown =
         (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ??
         '';

      // The local editor may already contain the latest value (for example,
      // after an optimistic save). Avoid resetting its selection unnecessarily.
      if (currentMarkdown === value) {
         lastReportedValue.current = currentMarkdown;
         lastSavedValue.current = currentMarkdown;
         return;
      }

      editor.commands.setContent(value, { emitUpdate: false });
      const md =
         (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown?.getMarkdown() ??
         '';
      lastReportedValue.current = md;
      lastSavedValue.current = md;
   }, [editor, value, isClickToEdit, isEditing]);

   // Sync editable state
   React.useEffect(() => {
      if (!editor || editor.isDestroyed) return;
      if (editor.isEditable !== editorIsEditable) {
         editor.setEditable(editorIsEditable);
      }
   }, [editor, editorIsEditable]);

   const startEditing = React.useCallback(() => {
      if (!editor || editor.isDestroyed || !editable) return;
      if (isClickToEdit) {
         setIsEditing(true);
      }
      requestAnimationFrame(() => {
         if (!editor.isDestroyed) {
            editor.setEditable(true);
            editor.commands.focus('end');
         }
      });
   }, [editor, editable, isClickToEdit]);

   const closeSlashMenu = React.useCallback(() => {
      setSlashState({
         isOpen: false,
         query: '',
         range: null,
         clientRect: null,
         command: null,
      });
   }, []);

   if (!isMounted) {
      return (
         <div
            className={cn(
               'w-full py-1 text-[15px] leading-7 text-muted-foreground/60',
               minHeight,
               className
            )}
         >
            {value ? (
               <div className="whitespace-pre-wrap font-sans opacity-70">{value}</div>
            ) : (
               <p className="opacity-50">{placeholder}</p>
            )}
         </div>
      );
   }

   return (
      <div
         className={cn(
            'relative w-full linear-tiptap-editor',
            editable && 'cursor-text',
            isClickToEdit && !isEditing && 'linear-tiptap-view',
            className
         )}
         role={isClickToEdit && editable ? 'button' : undefined}
         tabIndex={isClickToEdit && editable ? 0 : undefined}
         onClick={() => {
            if (isClickToEdit && !isEditing) {
               startEditing();
            } else if (editor && !editor.isFocused && editable) {
               editor.commands.focus();
            }
         }}
         onKeyDown={(event) => {
            if (isClickToEdit && !isEditing && (event.key === 'Enter' || event.key === ' ')) {
               event.preventDefault();
               startEditing();
            }
         }}
      >
         <EditorContent editor={editor} />
         <SlashCommandMenu
            state={slashState}
            onClose={closeSlashMenu}
            onKeyDownRef={onKeyDownRef}
         />
         {editorIsEditable && <LinearBubbleMenu editor={editor} />}
      </div>
   );
}
