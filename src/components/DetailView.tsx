import React, { useState, useEffect, useRef } from "react";
import { Box, Text, useInput } from "ink";
import { ListingDetail } from "../types.js";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";

// ANSI escape code for clickable URL
function clickableUrl(url: string, label?: string): string {
  const text = label || url;
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

// ASCII character set (light to dark for visibility on dark bg)
const ASCII_CHARS = " .·░▒▓█";

// Convert image to ASCII art
async function imageToAscii(imageUrl: string, maxWidth: number = 60): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;
    const buffer = await response.arrayBuffer();

    // Write to temp file for processing
    const tempPath = join("/tmp", "img-" + Date.now() + ".jpg");
    await writeFile(tempPath, Buffer.from(buffer));

    try {
      const sharp = (await import("sharp")).default;

      // Get image dimensions
      const metadata = await sharp(tempPath).metadata();
      const origWidth = metadata.width || maxWidth;
      const origHeight = metadata.height || maxWidth;

      // Calculate height maintaining aspect ratio
      const aspectRatio = origHeight / origWidth;
      const targetWidth = maxWidth;
      const targetHeight = Math.floor(targetWidth * aspectRatio * 0.5);

      // Resize image and convert to raw RGB
      const resizedBuffer = await sharp(tempPath)
        .resize(targetWidth, targetHeight, { fit: "fill" })
        .raw()
        .toBuffer();

      await unlink(tempPath).catch(() => {});

      // Convert to grayscale ASCII
      let ascii = "";
      for (let y = 0; y < targetHeight; y++) {
        let line = "";
        for (let x = 0; x < targetWidth; x++) {
          const idx = (y * targetWidth + x) * 3;
          if (idx >= resizedBuffer.length) {
            line += " ";
            continue;
          }
          const r = resizedBuffer[idx];
          const g = resizedBuffer[idx + 1];
          const b = resizedBuffer[idx + 2];
          const gray = Math.floor((r + g + b) / 3);
          const charIndex = Math.floor((gray / 255) * (ASCII_CHARS.length - 1));
          line += ASCII_CHARS[charIndex];
        }
        ascii += line + "\n";
      }
      return ascii;
    } catch {
      await unlink(tempPath).catch(() => {});
      return null;
    }
  } catch {
    return null;
  }
}

interface DetailViewProps {
  listing: ListingDetail | null;
  loading: boolean;
  onBack: () => void;
}

export function DetailView({ listing, loading, onBack }: DetailViewProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [asciiArt, setAsciiArt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Use ref to track conversion state
  const convertingRef = useRef(false);
  const asciiArtRef = useRef<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  if (loading) {
    return (
      <Box marginTop={1}>
        <Text color="yellow">Loading details...</Text>
      </Box>
    );
  }

  if (!listing) return null;

  const hasImages = (listing.images && listing.images.length > 0) || !!listing.imageUrl;
  const currentImage = hasImages
    ? (listing.images?.[selectedImageIndex] || listing.imageUrl)
    : null;
  const imageUrl = currentImage || listing.url;
  const totalImages = listing.images?.length || (listing.imageUrl ? 1 : 0);

  // Convert image to ASCII - useEffect with proper dependencies
  useEffect(() => {
    // Skip if no image or already converted
    if (!hasImages || !imageUrl) return;

    // Skip if we already have the ASCII art for this URL
    if (asciiArtRef.current && currentUrlRef.current === imageUrl) {
      setAsciiArt(asciiArtRef.current);
      return;
    }

    // Skip if already converting
    if (convertingRef.current) return;

    // Start conversion
    convertingRef.current = true;
    currentUrlRef.current = imageUrl;
    setError(null);

    imageToAscii(imageUrl, 60)
      .then((art) => {
        if (art) {
          asciiArtRef.current = art;
          setAsciiArt(art);
        } else {
          setError("Failed to convert image");
        }
      })
      .catch((err) => {
        setError("Error converting image: " + err.message);
      })
      .finally(() => {
        convertingRef.current = false;
      });
  }, [hasImages, imageUrl]);

  // Handle keyboard for image navigation
  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (!hasImages || totalImages <= 1) return;

    if (key.leftArrow && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
      // Clear cached ASCII to force re-conversion
      asciiArtRef.current = null;
      setAsciiArt(null);
    }
    if (key.rightArrow && selectedImageIndex < totalImages - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
      // Clear cached ASCII to force re-conversion
      asciiArtRef.current = null;
      setAsciiArt(null);
    }
  });

  // Parse attributes into an array
  const attributes = listing.attributes
    ? Object.entries(listing.attributes)
    : [];

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="white"
      padding={1}
    >
      {/* Product Header with Image Indicator */}
      <Box flexDirection="row" justifyContent="space-between">
        <Box width="75%">
          <Text bold color="green" inverse>
            {" " + listing.title.substring(0, 50) + (listing.title.length > 50 ? "..." : "") + " "}
          </Text>
        </Box>
        <Box width="25%">
          <Text color="cyan">
            {hasImages ? "📷 IMG" : "NO IMG"}
          </Text>
        </Box>
      </Box>

      <Text color="yellow" bold>
        {listing.priceText}
      </Text>
      <Text color="dim">ID: {listing.id}</Text>

      {/* Image Preview Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color="cyan">Image Preview:</Text>
        <Box
          borderStyle="double"
          borderColor="cyan"
          paddingX={1}
          paddingY={0}
          marginTop={0}
        >
          {error ? (
            <Text color="red">{error}</Text>
          ) : asciiArt ? (
            <Box flexDirection="column">
              {asciiArt.split("\n").map((line, i) => (
                <Text key={i} color="green">
                  {line}
                </Text>
              ))}
            </Box>
          ) : (
            <Box flexDirection="column">
              <Text color="yellow">Converting...</Text>
              <Text color="gray">
                (Press → to navigate if no image appears)
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Clickable URL Section */}
      <Box marginTop={1} flexDirection="column">
        <Text bold color="blue">URL:</Text>
        <Box
          borderStyle="single"
          borderColor="blue"
          paddingX={1}
          marginTop={0}
        >
          <Text color="blue">
            {clickableUrl(imageUrl)}
          </Text>
        </Box>
        <Text color="dim" italic>
          (Ctrl+Click to open in browser)
        </Text>
      </Box>

      {/* Image Navigation */}
      {hasImages && totalImages > 1 && (
        <Box marginTop={0} flexDirection="row" justifyContent="center">
          <Text color="dim">
            {selectedImageIndex === 0 ? "  " : "← "}
          </Text>
          <Text color="yellow">
            {selectedImageIndex + 1} / {totalImages}
          </Text>
          <Text color="dim">
            {selectedImageIndex === totalImages - 1 ? "  " : " →"}
          </Text>
        </Box>
      )}

      {/* Description */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Description:</Text>
        <Text>
          {listing.fullDescription || listing.description || "No description available"}
        </Text>
      </Box>

      {/* Product Details */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Details:</Text>
        <Text color="cyan">  📍 {listing.location}</Text>
        <Text color="cyan">  👤 {listing.sellerName}</Text>
        {listing.paylivery && (
          <Text color="magenta">  ✓ PayLivery Available</Text>
        )}
      </Box>

      {/* Attributes */}
      {attributes.length > 0 && (
        <Box marginTop={1} flexDirection="column">
          <Text bold>Attributes:</Text>
          {attributes.slice(0, 8).map(([key, val]) => (
            <Text key={key} color="dim">
              {"  • "}
              {key}:{" "}
              {Array.isArray(val) ? val.join(", ") : val}
            </Text>
          ))}
        </Box>
      )}

      {/* Quick Actions */}
      <Box marginTop={1}>
        <Text color="dim">Actions: </Text>
        <Text color="blue">URL</Text>
        <Text color="dim"> | </Text>
        <Text color="green">← Back</Text>
        {hasImages && totalImages > 1 && (
          <>
            <Text color="dim"> | </Text>
            <Text color="yellow">← → Images</Text>
          </>
        )}
      </Box>

      {/* Navigation Hint */}
      <Box marginTop={0}>
        <Text color="dim" italic>
          Esc: Back to list
        </Text>
      </Box>
    </Box>
  );
}
