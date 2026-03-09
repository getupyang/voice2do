import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const SELECT_FIELDS =
  'id, created_at, cleaned_text, intent, intent_data, status, completed_at, completion_note, completion_image_url';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const formData = await req.formData();
    const note = formData.get('completion_note') as string | null;
    const image = formData.get('completion_image') as File | null;

    // Upload image to Supabase Storage if provided
    let imageUrl: string | null = null;
    if (image && image.size > 0) {
      try {
        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = image.name.split('.').pop() || 'jpg';
        const filename = `completions/${id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('voice-memos')
          .upload(filename, buffer, { contentType: image.type, upsert: true });

        if (uploadError) {
          console.error('Image upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('voice-memos')
            .getPublicUrl(filename);
          imageUrl = urlData.publicUrl;
        }
      } catch (uploadErr) {
        // Non-fatal: proceed without image
        console.error('Image upload exception:', uploadErr);
      }
    }

    // Update dedicated completion columns — intentData is untouched
    const { data, error } = await supabase
      .from('memos')
      .update({
        status: 'done',
        completed_at: new Date().toISOString(),
        completion_note: note || null,
        completion_image_url: imageUrl,
      })
      .eq('id', id)
      .select(SELECT_FIELDS)
      .single();

    if (error) {
      console.error('Database update error:', error);
      return NextResponse.json(
        { success: false, error: '更新失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('PATCH memo error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '更新失败' },
      { status: 500 }
    );
  }
}
