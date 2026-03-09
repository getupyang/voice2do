import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const formData = await req.formData();
    const note = formData.get('completion_note') as string | null;
    const image = formData.get('completion_image') as File | null;

    let imageUrl: string | undefined;

    // Upload image to Supabase Storage if provided
    if (image && image.size > 0) {
      try {
        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const ext = image.name.split('.').pop() || 'jpg';
        const filename = `completions/${id}-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('voice-memos')
          .upload(filename, buffer, {
            contentType: image.type,
            upsert: true,
          });

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('voice-memos')
            .getPublicUrl(filename);
          imageUrl = urlData.publicUrl;
        } else {
          console.error('Image upload error:', uploadError);
        }
      } catch (uploadErr) {
        // Image upload failure is non-fatal; proceed without image
        console.error('Image upload exception:', uploadErr);
      }
    }

    // Fetch existing intent_data to preserve it
    const { data: existing } = await supabase
      .from('memos')
      .select('intent_data')
      .eq('id', id)
      .single();

    const updatedIntentData = {
      ...(existing?.intent_data || {}),
      completion_note: note || undefined,
      completion_image_url: imageUrl,
      completed_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('memos')
      .update({
        status: 'done',
        intent_data: updatedIntentData,
      })
      .eq('id', id)
      .select('id, created_at, cleaned_text, intent, intent_data, status')
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
