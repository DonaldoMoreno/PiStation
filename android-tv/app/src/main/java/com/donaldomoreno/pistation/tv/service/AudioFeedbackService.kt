package com.donaldomoreno.pistation.tv.service

import android.media.AudioManager
import android.media.ToneGenerator

interface AudioFeedbackService {
    fun playTransition(enabled: Boolean)
    fun release()
}

class ToneAudioFeedbackService : AudioFeedbackService {
    private val toneGenerator = ToneGenerator(AudioManager.STREAM_NOTIFICATION, 35)

    override fun playTransition(enabled: Boolean) {
        if (!enabled) return
        toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP, 110)
    }

    override fun release() {
        toneGenerator.release()
    }
}
