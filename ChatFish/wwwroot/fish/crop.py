from PIL import Image
import numpy as np
import os
import glob


def get_non_transparent_bbox(frame):
    alpha = np.array(frame.convert("RGBA"))[:, :, 3]
    non_zero = np.nonzero(alpha)
    return [
        np.min(non_zero[1]),
        np.min(non_zero[0]),
        np.max(non_zero[1]),
        np.max(non_zero[0]),
    ]


def crop_animated_png(input_path, output_path):
    # Open the animated PNG
    with Image.open(input_path) as img:
        frames = []
        bboxes = []

        # Process each frame
        for frame_index in range(img.n_frames):
            img.seek(frame_index)
            frame = img.copy()
            bbox = get_non_transparent_bbox(frame)
            frames.append(frame)
            bboxes.append(bbox)

        # Calculate the overall bounding box
        left = min(bbox[0] for bbox in bboxes)
        top = min(bbox[1] for bbox in bboxes)
        right = max(bbox[2] for bbox in bboxes)
        bottom = max(bbox[3] for bbox in bboxes)

        # Crop and save frames
        cropped_frames = []
        for frame in frames:
            cropped = frame.crop((left, top, right, bottom))
            cropped_frames.append(cropped)

        # Save the cropped animated PNG
        cropped_frames[0].save(
            output_path,
            save_all=True,
            append_images=cropped_frames[1:],
            duration=img.info.get("duration", 100),
            loop=img.info.get("loop", 0),
            optimize=False,
        )


images = glob.glob("./**/*.png", recursive=True)

for image in images:
    crop_animated_png(image, image)
    print(f"Cropped {image}")

# Usage
# input_file = "./Blue/Left-66.png"
# output_file = "output_cropped_animated.png"
# crop_animated_png(input_file, output_file)
# print(f"Cropped animated PNG saved as {output_file}")
