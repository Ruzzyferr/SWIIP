// AppLoopbackEx — WASAPI process-loopback capture with selectable mode.
//
// Usage:
//   AppLoopbackEx.exe <pid> [include|exclude]
//
// - include (default): capture audio from the target process AND its descendants.
// - exclude: capture system audio EXCEPT the target process tree. Use this to
//   pull "everything but Swiip itself" so we can share system audio during
//   screen share without echoing our own voice playback back into the mix.
//
// Output: raw PCM on stdout — int16 little-endian, 48 kHz, 2 channels interleaved.
// Windows resamples/mixes into this format for us (shared-mode IAudioClient).
//
// Stops when:
//   * stdout write fails (parent process closed the pipe / died)
//   * Ctrl+C / Ctrl+Break received
//   * capture client returns a fatal error
//
// Build: invoked by build.ps1 via MSVC. See that script for the exact cl args.
// Requires the Windows 10 SDK (audioclientactivationparams.h). The underlying
// PROCESS_LOOPBACK APIs need Windows 10 build 19041+ at runtime.

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <audioclientactivationparams.h>
#include <avrt.h>
#include <wrl/implements.h>
#include <stdio.h>
#include <io.h>
#include <fcntl.h>
#include <atomic>
#include <string>
#include <cwchar>
#include <climits>

#pragma comment(lib, "mmdevapi.lib")
#pragma comment(lib, "ole32.lib")
#pragma comment(lib, "avrt.lib")
#pragma comment(lib, "runtimeobject.lib")

using Microsoft::WRL::ClassicCom;
using Microsoft::WRL::ComPtr;
using Microsoft::WRL::FtmBase;
using Microsoft::WRL::MakeAndInitialize;
using Microsoft::WRL::RuntimeClass;
using Microsoft::WRL::RuntimeClassFlags;

namespace {

// Output format. Matches what the renderer-side pcm-feeder worklet expects.
constexpr UINT32 kSampleRate = 48000;
constexpr UINT16 kChannels = 2;
constexpr UINT16 kBitsPerSample = 16;
// 20 ms buffer. For process-loopback activation, periodicity must match
// buffer duration (per audioclient.h docs for the activation path).
constexpr REFERENCE_TIME kBufferDuration = 200000;  // 100-ns units => 20 ms.

std::atomic<bool> g_stop{false};

BOOL WINAPI CtrlHandler(DWORD /*type*/) {
  g_stop.store(true, std::memory_order_release);
  return TRUE;
}

// COM callback that receives the IAudioClient from ActivateAudioInterfaceAsync.
class ActivateHandler final
    : public RuntimeClass<RuntimeClassFlags<ClassicCom>, FtmBase,
                          IActivateAudioInterfaceCompletionHandler> {
 public:
  HRESULT RuntimeClassInitialize() {
    done_ = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    return done_ ? S_OK : HRESULT_FROM_WIN32(GetLastError());
  }

  ~ActivateHandler() {
    if (done_) CloseHandle(done_);
  }

  STDMETHOD(ActivateCompleted)
  (IActivateAudioInterfaceAsyncOperation* op) override {
    HRESULT activateHr = E_FAIL;
    ComPtr<IUnknown> unk;
    HRESULT hr = op->GetActivateResult(&activateHr, &unk);
    if (SUCCEEDED(hr) && SUCCEEDED(activateHr) && unk) {
      unk.As(&client_);
    }
    status_ = SUCCEEDED(hr) ? activateHr : hr;
    SetEvent(done_);
    return S_OK;
  }

  HANDLE Event() const { return done_; }
  HRESULT Status() const { return status_; }
  ComPtr<IAudioClient> Client() const { return client_; }

 private:
  HANDLE done_ = nullptr;
  ComPtr<IAudioClient> client_;
  HRESULT status_ = E_FAIL;
};

// Write all bytes to a HANDLE, returning false if the pipe closed or errored.
bool WriteAll(HANDLE h, const void* data, DWORD size) {
  const BYTE* p = reinterpret_cast<const BYTE*>(data);
  while (size > 0) {
    DWORD written = 0;
    if (!WriteFile(h, p, size, &written, nullptr)) return false;
    if (written == 0) return false;
    p += written;
    size -= written;
  }
  return true;
}

int Run(DWORD pid, PROCESS_LOOPBACK_MODE mode) {
  HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
  if (FAILED(hr)) {
    fwprintf(stderr, L"CoInitializeEx failed: 0x%08lX\n", hr);
    return 1;
  }

  AUDIOCLIENT_ACTIVATION_PARAMS params = {};
  params.ActivationType = AUDIOCLIENT_ACTIVATION_TYPE_PROCESS_LOOPBACK;
  params.ProcessLoopbackParams.TargetProcessId = pid;
  params.ProcessLoopbackParams.ProcessLoopbackMode = mode;

  PROPVARIANT activateParams = {};
  activateParams.vt = VT_BLOB;
  activateParams.blob.cbSize = sizeof(params);
  activateParams.blob.pBlobData = reinterpret_cast<BYTE*>(&params);

  ComPtr<ActivateHandler> handler;
  hr = MakeAndInitialize<ActivateHandler>(&handler);
  if (FAILED(hr)) {
    fwprintf(stderr, L"MakeAndInitialize failed: 0x%08lX\n", hr);
    CoUninitialize();
    return 1;
  }

  ComPtr<IActivateAudioInterfaceAsyncOperation> op;
  hr = ActivateAudioInterfaceAsync(VIRTUAL_AUDIO_DEVICE_PROCESS_LOOPBACK,
                                   __uuidof(IAudioClient), &activateParams,
                                   handler.Get(), &op);
  if (FAILED(hr)) {
    fwprintf(stderr, L"ActivateAudioInterfaceAsync failed: 0x%08lX\n", hr);
    CoUninitialize();
    return 1;
  }

  WaitForSingleObject(handler->Event(), INFINITE);
  if (FAILED(handler->Status())) {
    fwprintf(stderr, L"Activate completion failed: 0x%08lX\n", handler->Status());
    CoUninitialize();
    return 1;
  }

  ComPtr<IAudioClient> client = handler->Client();
  if (!client) {
    fwprintf(stderr, L"No IAudioClient from activation\n");
    CoUninitialize();
    return 1;
  }

  WAVEFORMATEX wfx = {};
  wfx.wFormatTag = WAVE_FORMAT_PCM;
  wfx.nChannels = kChannels;
  wfx.nSamplesPerSec = kSampleRate;
  wfx.wBitsPerSample = kBitsPerSample;
  wfx.nBlockAlign = wfx.nChannels * wfx.wBitsPerSample / 8;
  wfx.nAvgBytesPerSec = wfx.nSamplesPerSec * wfx.nBlockAlign;

  hr = client->Initialize(AUDCLNT_SHAREMODE_SHARED,
                          AUDCLNT_STREAMFLAGS_LOOPBACK |
                              AUDCLNT_STREAMFLAGS_EVENTCALLBACK,
                          kBufferDuration, kBufferDuration, &wfx, nullptr);
  if (FAILED(hr)) {
    fwprintf(stderr, L"IAudioClient::Initialize failed: 0x%08lX\n", hr);
    CoUninitialize();
    return 1;
  }

  HANDLE packetEvent = CreateEventW(nullptr, FALSE, FALSE, nullptr);
  if (!packetEvent) {
    fwprintf(stderr, L"CreateEvent failed\n");
    CoUninitialize();
    return 1;
  }

  hr = client->SetEventHandle(packetEvent);
  if (FAILED(hr)) {
    fwprintf(stderr, L"SetEventHandle failed: 0x%08lX\n", hr);
    CloseHandle(packetEvent);
    CoUninitialize();
    return 1;
  }

  ComPtr<IAudioCaptureClient> capture;
  hr = client->GetService(IID_PPV_ARGS(&capture));
  if (FAILED(hr)) {
    fwprintf(stderr, L"GetService(IAudioCaptureClient) failed: 0x%08lX\n", hr);
    CloseHandle(packetEvent);
    CoUninitialize();
    return 1;
  }

  hr = client->Start();
  if (FAILED(hr)) {
    fwprintf(stderr, L"IAudioClient::Start failed: 0x%08lX\n", hr);
    CloseHandle(packetEvent);
    CoUninitialize();
    return 1;
  }

  DWORD taskIndex = 0;
  HANDLE mmcss = AvSetMmThreadCharacteristicsW(L"Pro Audio", &taskIndex);

  HANDLE hStdOut = GetStdHandle(STD_OUTPUT_HANDLE);
  const UINT32 bytesPerFrame = wfx.nBlockAlign;  // stereo 16-bit => 4.

  // Reusable zero buffer for silent packets.
  std::string silence;

  while (!g_stop.load(std::memory_order_acquire)) {
    // 2-second watchdog: wake up periodically even without packets to notice
    // Ctrl+C and parent-pipe closure.
    DWORD waitResult = WaitForSingleObject(packetEvent, 2000);
    if (waitResult == WAIT_TIMEOUT) continue;
    if (waitResult != WAIT_OBJECT_0) break;

    UINT32 packetSize = 0;
    hr = capture->GetNextPacketSize(&packetSize);
    if (FAILED(hr)) break;

    while (packetSize != 0) {
      BYTE* data = nullptr;
      UINT32 framesAvailable = 0;
      DWORD flags = 0;
      hr = capture->GetBuffer(&data, &framesAvailable, &flags, nullptr, nullptr);
      if (FAILED(hr)) {
        g_stop.store(true, std::memory_order_release);
        break;
      }

      const DWORD bytes = framesAvailable * bytesPerFrame;
      if (flags & AUDCLNT_BUFFERFLAGS_SILENT) {
        if (silence.size() < bytes) silence.resize(bytes, 0);
        if (bytes > 0 && !WriteAll(hStdOut, silence.data(), bytes)) {
          g_stop.store(true, std::memory_order_release);
        }
      } else if (data && bytes > 0) {
        if (!WriteAll(hStdOut, data, bytes)) {
          g_stop.store(true, std::memory_order_release);
        }
      }

      capture->ReleaseBuffer(framesAvailable);
      if (g_stop.load(std::memory_order_acquire)) break;

      hr = capture->GetNextPacketSize(&packetSize);
      if (FAILED(hr)) {
        g_stop.store(true, std::memory_order_release);
        break;
      }
    }
  }

  client->Stop();
  if (mmcss) AvRevertMmThreadCharacteristics(mmcss);
  CloseHandle(packetEvent);
  capture.Reset();
  client.Reset();
  CoUninitialize();
  return 0;
}

int ParseArgs(int argc, wchar_t* argv[], DWORD& pid,
              PROCESS_LOOPBACK_MODE& mode) {
  if (argc < 2) {
    fwprintf(stderr, L"Usage: AppLoopbackEx.exe <pid> [include|exclude]\n");
    return 2;
  }
  wchar_t* end = nullptr;
  unsigned long v = wcstoul(argv[1], &end, 10);
  if (end == argv[1] || v == 0 || v == ULONG_MAX) {
    fwprintf(stderr, L"Invalid pid: %ls\n", argv[1]);
    return 2;
  }
  pid = static_cast<DWORD>(v);

  mode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;
  if (argc >= 3) {
    if (wcscmp(argv[2], L"exclude") == 0) {
      mode = PROCESS_LOOPBACK_MODE_EXCLUDE_TARGET_PROCESS_TREE;
    } else if (wcscmp(argv[2], L"include") == 0) {
      mode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;
    } else {
      fwprintf(stderr, L"Invalid mode: %ls (must be include or exclude)\n",
               argv[2]);
      return 2;
    }
  }
  return 0;
}

}  // namespace

int wmain(int argc, wchar_t* argv[]) {
  _setmode(_fileno(stdout), _O_BINARY);

  DWORD pid = 0;
  PROCESS_LOOPBACK_MODE mode = PROCESS_LOOPBACK_MODE_INCLUDE_TARGET_PROCESS_TREE;
  if (int rc = ParseArgs(argc, argv, pid, mode); rc != 0) return rc;

  SetConsoleCtrlHandler(CtrlHandler, TRUE);
  return Run(pid, mode);
}
