<script setup lang="ts">
const { available, latestBuild, reload } = useAppUpdate()
</script>

<template>
  <!-- Always mounted: screen readers announce content added to an existing live region, not a region inserted with its content. -->
  <div role="status">
    <Transition enter-from-class="-translate-y-full opacity-0" leave-to-class="-translate-y-full opacity-0">
      <!-- z-60: above the z-50 of Nuxt UI's sticky UHeader. Overlays like UModal and the toaster mount outside the app, so they still cover it. -->
      <div
        v-if="available"
        class="
          fixed inset-x-3 top-3 z-60 mx-auto max-w-fit rounded-full p-0.5
          transition duration-300 ease-out
          motion-reduce:transition-none
        "
      >
        <!-- Rainbow behind the opaque pill: sharp in the p-0.5 gap as the border, blurred as the glow. -->
        <div
          v-for="layer in ['', 'opacity-90 blur-lg']"
          :key="layer"
          aria-hidden="true"
          class="absolute inset-0 -z-10 overflow-hidden rounded-full"
          :class="layer"
        >
          <!-- Squashed to the pill's aspect ratio (50px / 319px) so the colors travel the border evenly instead of racing along the long edges. -->
          <div
            class="
              absolute inset-x-0 top-1/2 aspect-square -translate-y-1/2
              scale-y-[0.16]
            "
          >
            <div
              class="
                absolute -inset-1/2 animate-spin
                bg-[conic-gradient(var(--ui-error),var(--ui-warning),var(--ui-success),var(--ui-info),var(--ui-error))]
                [animation-duration:4s]
                motion-reduce:animate-none
              "
            />
          </div>
        </div>
        <UBanner
          icon="i-lucide-sparkles"
          :actions="[{ label: 'Aggiorna', color: 'neutral', size: 'sm', class: 'rounded-full', onClick: reload }]"
          class="
            bg-default rounded-full
            forced-colors:outline
          "
          :ui="{
            container: 'h-auto py-1.5 ps-4 pe-1.5 sm:ps-4 sm:pe-1.5 lg:ps-4 lg:pe-1.5',
            left: 'lg:hidden',
            center: 'gap-3',
            right: 'hidden',
            icon: 'text-warning',
            title: 'text-highlighted',
          }"
        >
          <template #title>
            <span class="flex flex-col leading-tight">
              <span class="truncate">Nuova versione disponibile</span>
              <NuxtTime
                v-if="latestBuild"
                :datetime="latestBuild.timestamp"
                relative
                numeric="auto"
                :title="new Date(latestBuild.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })"
                class="text-muted text-xs font-normal"
              />
            </span>
          </template>
        </UBanner>
      </div>
    </Transition>
  </div>
</template>
