# audio_manager.py
import pyaudio
import threading
import queue
import logging

logger = logging.getLogger(__name__)

class AudioManager:
    def __init__(self, sample_rate=24000, chunk_size=512):
        self.sample_rate = sample_rate
        self.chunk_size = chunk_size
        self.audio = pyaudio.PyAudio()
        self.audio_queue = queue.Queue()
        self.audio_buffer = b""
        self.playback_thread = None
        self.playback_active = False
        self.input_stream = None
        self.output_stream = None

    def start_streams(self, input_device_index=None, output_device_index=None):
        try:
            self.input_stream = self.audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.sample_rate,
                input=True,
                frames_per_buffer=self.chunk_size,
                input_device_index=input_device_index
            )
            self.output_stream = self.audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=self.sample_rate,
                output=True,
                frames_per_buffer=self.chunk_size,
                output_device_index=output_device_index
            )
            self.playback_active = True
            self.playback_thread = threading.Thread(target=self._playback_worker, daemon=True)
            self.playback_thread.start()
            logger.info("🎵 Audio streams initialized")
        except Exception as e:
            logger.exception("Audio stream start failed")
            raise

    def _playback_worker(self):
        buffer_size = 4096
        while self.playback_active:
            try:
                audio_data = self.audio_queue.get(timeout=0.1)
                if audio_data is None:
                    break
                self.audio_buffer += audio_data
                while len(self.audio_buffer) >= buffer_size and self.playback_active:
                    chunk = self.audio_buffer[:buffer_size]
                    self.audio_buffer = self.audio_buffer[buffer_size:]
                    try:
                        if self.output_stream and self.playback_active:
                            self.output_stream.write(chunk)
                    except Exception:
                        break  # Exit on stream error
            except queue.Empty:
                if self.audio_buffer and self.playback_active:
                    try:
                        if self.output_stream:
                            self.output_stream.write(self.audio_buffer)
                            self.audio_buffer = b""
                    except Exception:
                        break  # Exit on stream error

    def stop(self):
        self.playback_active = False
        if self.playback_thread and self.playback_thread.is_alive():
            self.audio_queue.put(None)
            self.playback_thread.join(timeout=3)
        try:
            if self.input_stream:
                self.input_stream.stop_stream()
                self.input_stream.close()
                self.input_stream = None
            if self.output_stream:
                self.output_stream.stop_stream()
                self.output_stream.close()
                self.output_stream = None
        except Exception:
            pass  # Silent cleanup
        try:
            self.audio.terminate()
        except Exception:
            pass  # Silent cleanup
