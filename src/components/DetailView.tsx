import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ListingDetail } from "../types.js";
import { createImageFrame, createSmallIcon, createImagePlaceholder } from "./ascii-art.js";

// ANSI escape code for clickable URL
function clickableUrl(url: string, label?: string): string {
  const text = label || url;
  // OSC 8 ; params ; URI ST
  return `\x1b]8;;${url}\x07${text}\x1b]8;;\x07`;
}

interface DetailViewProps {
  listing: ListingDetail | null;
  loading: boolean;
  onBack: () => void;
}

export function DetailView({ listing, loading, onBack }: DetailViewProps) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  if (loading) {
    return (
      <Box marginTop={1}>
        <Text color="yellow">Loading details...</Text>
      </Box>
    );
  }

  if (!listing) return null;

  const hasImages = listing.images && listing.images.length > 0;
  const currentImage = hasImages ? listing.images[selectedImageIndex] : null;

  // Handle keyboard for image navigation
  useInput((input, key) => {
    if (!hasImages) return;

    if (key.leftArrow && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
    if (key.rightArrow && selectedImageIndex < listing.images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    }
  });

  return (
    <Box
      flexDirection="column"
      marginTop={1}
      borderStyle="round"
      borderColor="white"
      padding={1}
    >
      {/* Product Header */}
      <Text bold color="green" inverse>
        {" " + listing.title.substring(0, 50) + (listing.title.length > 50 ? "..." : "") + " "}
      </Text>
      <Text color="yellow" bold>
        {listing.priceText}
      </Text>
      <Text color="dim">ID: {listing.id}</Text>

      {/* Image Preview Section */}
      {hasImages && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold color="cyan">
            📷 Images ({listing.images.length}):
          </Text>

          {/* ASCII Image Frame */}
          <Box
            borderStyle="double"
            borderColor="cyan"
            paddingX={2}
            paddingY={1}
            marginTop={0}
          >
            <Text color="cyan">
              {createImagePlaceholder(40, 8)}
            </Text>
          </Box>

          {/* Image Navigation */}
          <Box flexDirection="row" marginTop={0} justifyContent="space-between">
            <Text color="dim">
              {selectedImageIndex === 0 ? "  " : "← "}
            </Text>
            <Text color="yellow">
              {selectedImageIndex + 1} / {listing.images.length}
            </Text>
            <Text color="dim">
              {selectedImageIndex === listing.images.length - 1 ? "  " : " →"}
            </Text>
          </Box>

          {/* Clickable URL */}
          <Box marginTop={0} flexDirection="column">
            <Text color="dim" italic>
              Click or copy URL:
            </Text>
            <Text color="blue">
              {clickableUrl(
                currentImage || listing.url,
                currentImage?.substring(0, 60) + "..."
              )}
            </Text>
          </Box>

          {/* URL hint */}
          <Text color="dim" italic>
            (Ctrl+Click to open in browser)
          </Text>
        </Box>
      )}

      {/* Description */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Description:</Text>
        <Text>
          {listing.fullDescription || listing.description}
        </Text>
      </Box>

      {/* Product Details */}
      <Box marginTop={1} flexDirection="column">
        <Text bold>Details:</Text>
        <Text color="cyan">📍 {listing.location}</Text>
        <Text color="cyan">👤 {listing.sellerName}</Text>
        {listing.paylivery && (
          <Text color="magenta">✓ PayLivery Available</Text>
        )}
      </Box>

      {/* Attributes */}
      {listing.attributes &&
        Object.keys(listing.attributes).length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text bold>Attributes:</Text>
            {Object.entries(listing.attributes)
              .slice(0, 10)
              .map(([key, val]) => (
                <Text key={key} color="dim">
                  • {key}: {Array.isArray(val) ? val.join(", ") : val}
                </Text>
              ))}
          </Box>
        )}

      {/* Quick Actions */}
      <Box marginTop={1} flexDirection="row">
        <Text color="dim">Actions: </Text>
        <Text color="blue">URL</Text>
        <Text color="dim"> | </Text>
        <Text color="green">← Back</Text>
      </Box>

      {/* Navigation Hint */}
      <Box marginTop={0}>
        <Text color="dim" italic>
          ← →: Browse images | Esc: Back
        </Text>
      </Box>
    </Box>
  );
}
