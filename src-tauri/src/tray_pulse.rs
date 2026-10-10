//! Frames for the short pulse on the menu bar icon when new items arrive.
//!
//! The pulse dims the icon and leaves a bright ring that travels from the
//! centre outwards, so a handful of frames reads as a signal. It works on the
//! alpha channel, which is what a template icon is drawn from, so it also shows
//! in the default monochrome mode.

/// Ring position per frame, as a share of the icon's radius.
pub const PULSE_STEPS: [f32; 5] = [0.0, 0.25, 0.5, 0.75, 1.0];
pub const PULSE_FRAME_MS: u64 = 80;

const DIMMED_ALPHA: f32 = 0.35;
const RING_WIDTH: f32 = 0.22;
const MIN_RING_WIDTH_PX: f32 = 3.0;

const CHANNELS: usize = 4;

fn centre_distance(pixel: usize, width: u32, cx: f32, cy: f32) -> f32 {
    let x = (pixel as u32 % width) as f32;
    let y = (pixel as u32 / width) as f32;
    ((x - cx).powi(2) + (y - cy).powi(2)).sqrt()
}

/// `rgba` is a `width`-pixel-wide RGBA image. Returns the same image with the
/// ring at `progress` (0.0 centre, 1.0 edge) bright and everything else dimmed.
pub fn pulse_frame(rgba: &[u8], width: u32, height: u32, progress: f32) -> Vec<u8> {
    let cx = width as f32 / 2.0;
    let cy = height as f32 / 2.0;
    let pixels = rgba.len() / CHANNELS;
    let visible = |pixel: usize| rgba[pixel * CHANNELS + 3] > 0;

    let radius = (0..pixels)
        .filter(|&pixel| visible(pixel))
        .map(|pixel| centre_distance(pixel, width, cx, cy))
        .fold(0.0_f32, f32::max);

    let ring = progress * radius;
    let band = (radius * RING_WIDTH).max(MIN_RING_WIDTH_PX);

    let mut frame = rgba.to_vec();
    for pixel in (0..pixels).filter(|&pixel| visible(pixel)) {
        let at = pixel * CHANNELS;
        if (centre_distance(pixel, width, cx, cy) - ring).abs() <= band {
            frame[at..at + 3].fill(255);
        } else {
            frame[at + 3] = (frame[at + 3] as f32 * DIMMED_ALPHA) as u8;
        }
    }
    frame
}

#[cfg(test)]
mod tests {
    use super::*;

    const SIZE: u32 = 21;

    fn opaque_icon() -> Vec<u8> {
        [200u8, 100, 50, 255].repeat((SIZE * SIZE) as usize)
    }

    fn pixel(frame: &[u8], x: u32, y: u32) -> [u8; 4] {
        let i = ((y * SIZE + x) * 4) as usize;
        [frame[i], frame[i + 1], frame[i + 2], frame[i + 3]]
    }

    #[test]
    fn keeps_the_image_size() {
        let icon = opaque_icon();
        assert_eq!(pulse_frame(&icon, SIZE, SIZE, 0.5).len(), icon.len());
    }

    #[test]
    fn keeps_transparent_pixels_transparent() {
        let mut icon = opaque_icon();
        icon[3] = 0;
        let frame = pulse_frame(&icon, SIZE, SIZE, 0.5);
        assert_eq!(frame[3], 0);
    }

    #[test]
    fn lights_the_centre_at_the_start_and_dims_the_edge() {
        let frame = pulse_frame(&opaque_icon(), SIZE, SIZE, 0.0);
        assert_eq!(pixel(&frame, 10, 10), [255, 255, 255, 255]);
        let corner = pixel(&frame, 0, 0);
        assert!(corner[3] < 255, "the edge should be dimmed");
        assert_eq!(&corner[..3], &[200, 100, 50]);
    }

    #[test]
    fn moves_the_ring_outwards() {
        let early = pulse_frame(&opaque_icon(), SIZE, SIZE, 0.0);
        let late = pulse_frame(&opaque_icon(), SIZE, SIZE, 1.0);
        assert_eq!(pixel(&early, 10, 10)[3], 255);
        assert!(
            pixel(&late, 10, 10)[3] < 255,
            "the centre dims once the ring has passed"
        );
        assert_eq!(pixel(&late, 0, 0)[3], 255);
    }

    #[test]
    fn dims_everything_outside_the_ring_to_the_same_level() {
        let frame = pulse_frame(&opaque_icon(), SIZE, SIZE, 0.0);
        let expected = (255.0 * DIMMED_ALPHA) as u8;
        assert_eq!(pixel(&frame, 0, 0)[3], expected);
        assert_eq!(pixel(&frame, 20, 20)[3], expected);
    }
}
