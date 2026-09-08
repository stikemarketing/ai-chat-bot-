import os
import subprocess

import modal

APP_NAME = "ai-companion-vllm-qwen3-test"
MODEL_NAME = "Qwen/Qwen3-14B"
PORT = 8000

app = modal.App(APP_NAME)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements("requirements.txt")
)

model_cache = modal.Volume.from_name(
    "ai-companion-model-cache",
    create_if_missing=True,
)


@app.function(
    image=image,
    gpu="L40S",
    timeout=60 * 60,
    min_containers=0,
    scaledown_window=5 * 60,
    volumes={"/models": model_cache},
)
@modal.web_server(port=PORT, startup_timeout=60 * 15)
def serve():
    os.environ["HF_HOME"] = "/models"
    os.environ["HUGGINGFACE_HUB_CACHE"] = "/models"

    command = [
        "vllm",
        "serve",
        MODEL_NAME,
        "--host",
        "0.0.0.0",
        "--port",
        str(PORT),
        "--dtype",
        "auto",
        "--max-model-len",
        "4096",
        "--gpu-memory-utilization",
        "0.9",
        "--max-num-seqs",
        "2",
        "--default-chat-template-kwargs",
        '{"enable_thinking": false}',
    ]

    subprocess.Popen(command)


@app.local_entrypoint()
def main():
    print(f"Test model: {MODEL_NAME}")
    print("GPU: L40S")
    print("Minimum containers: 0")
    print("Thinking mode: disabled")
