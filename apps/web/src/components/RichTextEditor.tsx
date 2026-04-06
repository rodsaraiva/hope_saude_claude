'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { Bold, Italic, List, ListOrdered, Underline as UnderlineIcon, Undo, Redo, Quote } from 'lucide-react';

interface Props {
  content: string;
  onChange: (content: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function RichTextEditor({ content, onChange, readOnly = false, className = '' }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Podemos desabilitar o que não quisermos do starter kit
      }),
      Underline,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editable: !readOnly,
    immediatelyRender: false,
  });

  // Sincronizar conteúdo se mudar via props (ex: ao trocar de registro)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Atualizar estado de leitura
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  if (!editor) {
    return null;
  }

  const MenuButton = ({ 
    onClick, 
    isActive, 
    icon: Icon, 
    title, 
    disabled = false 
  }: { 
    onClick: () => void; 
    isActive?: boolean; 
    icon: any; 
    title: string; 
    disabled?: boolean;
  }) => (
    <button
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled || readOnly}
      title={title}
      className={`p-1.5 rounded-md transition-all ${
        isActive 
          ? 'bg-sky-100 text-sky-700 font-bold' 
          : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );

  return (
    <div className={`flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white focus-within:ring-1 focus-within:ring-sky-500 transition-all ${className}`}>
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-1.5 bg-slate-50 border-b border-slate-100">
          <MenuButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            icon={Bold}
            title="Negrito (Ctrl+B)"
          />
          <MenuButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            icon={Italic}
            title="Itálico (Ctrl+I)"
          />
          <MenuButton
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            isActive={editor.isActive('underline')}
            icon={UnderlineIcon}
            title="Sublinhado (Ctrl+U)"
          />
          
          <div className="w-px h-4 bg-slate-200 mx-1" />

          <MenuButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            icon={List}
            title="Lista com Marcadores"
          />
          <MenuButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            icon={ListOrdered}
            title="Lista Numerada"
          />
          <MenuButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            icon={Quote}
            title="Citação"
          />

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <MenuButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            icon={Undo}
            title="Desfazer"
          />
          <MenuButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            icon={Redo}
            title="Refazer"
          />
        </div>
      )}

      <EditorContent 
        editor={editor} 
        className="prose prose-sm prose-slate max-w-none p-4 min-h-[300px] focus:outline-none overflow-y-auto"
      />
      
      <style jsx global>{`
        .ProseMirror {
          min-height: 300px;
          outline: none;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd;
          pointer-events: none;
          height: 0;
        }
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #e2e8f0;
          padding-left: 1rem;
          font-style: italic;
          color: #64748b;
        }
      `}</style>
    </div>
  );
}
