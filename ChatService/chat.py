from transformers import AutoModelForCausalLM, AutoTokenizer


def load_qwen():
    model_name = "Qwen/Qwen2.5-7B-Instruct"

    model = AutoModelForCausalLM.from_pretrained(
        model_name, torch_dtype="auto", device_map="cuda"
    )
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    return model, tokenizer


def chat_with_qwen(model, tokenizer, prompt: str) -> str:
    messages = [
        {
            "role": "system",
            "content": "You are chat-fish. A cheerful fish that likes to chat. You are kind of forgetful.",
        },
        {"role": "user", "content": prompt},
    ]
    text = tokenizer.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    model_inputs = tokenizer([text], return_tensors="pt").to("cuda")

    generated_ids = model.generate(**model_inputs, max_new_tokens=512)
    generated_ids = [
        output_ids[len(input_ids) :]
        for input_ids, output_ids in zip(model_inputs.input_ids, generated_ids)
    ]

    response = tokenizer.batch_decode(generated_ids, skip_special_tokens=True)[0]

    return response
