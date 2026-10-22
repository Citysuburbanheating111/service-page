import {defineQuery} from 'next-sanity'

export const REFERENCE_SERVICE_QUERY = defineQuery(`
  *[_type == "referenceServicePage" && clusterSlug == $clusterSlug && slug.current in $serviceSlugs]
    | order(select(slug.current == $serviceSlugs[0] => 0, 1) asc)[0] {
    name, clusterSlug, directoryClusterSlug, "slug": slug.current,
    metaTitle, metaDescription, canonicalUrl, livePath, qcStatus, structuredData,
    "responsiveCss": coalesce(template->responsiveCss, responsiveCss), sections[]{_key, module, html, contentFields[]{_key,target,kind,label,value}},
    "cardImage": coalesce(cardImage.asset->url, cardImageUrl),
    cardDescription, keyPhrases,
    workWeHandle[]{title, text, icon},
    "serviceSections": template->serviceSections
  }
`)

export const REFERENCE_NAVIGATION_QUERY = defineQuery(`
  *[_type == "referenceServicePage" && defined(slug.current)] {
    name, clusterSlug, directoryClusterSlug, "slug": slug.current, livePath, canonicalUrl, cardDescription,
    "cardImage": coalesce(cardImage.asset->url, cardImageUrl),
    metaTitle, metaDescription, qcStatus
  }
`)

export const SERVICE_INDEX_QUERY = defineQuery(`
  *[_type == "servicePage" && defined(service->slug.current) && defined(area->slug.current)] | order(service->monthlySearchVolume desc) {
    _id,
    title,
    "serviceSlug": service->slug.current,
    "areaSlug": area->slug.current,
    "serviceName": service->name,
    "areaName": area->name,
    "monthlySearchVolume": service->monthlySearchVolume,
    "metaDescription": seo.description,
    "cardImage": coalesce(
      coverImage.image.asset->url,
      coverImage.externalUrl,
      gallery[0].image.asset->url,
      gallery[0].externalUrl,
      workingPhotos[0].image.asset->url,
      workingPhotos[0].externalUrl
    )
  }
`)

export const SERVICE_NAVIGATION_QUERY = defineQuery(`
  {
    "clusters": *[_type == "serviceCluster" && active != false] | order(displayOrder asc) {
      _id,
      name,
      "slug": slug.current,
      description,
      displayOrder,
      sourceServiceCount,
      monthlySearchVolume,
      chicagoSearchVolume,
      requiresScopeReview
    },
    "pages": *[_type == "servicePage" && defined(service->slug.current) && defined(area->slug.current)] | order(service->monthlySearchVolume desc) {
      _id,
      title,
      "serviceSlug": service->slug.current,
      "areaSlug": area->slug.current,
      "serviceName": service->name,
      "areaName": area->name,
      "monthlySearchVolume": service->monthlySearchVolume,
      "metaDescription": seo.description,
      "clusterId": service->cluster._ref,
      "clusterName": coalesce(service->cluster->name, service->parentName),
      "clusterSlug": service->cluster->slug.current,
      "scopeStatus": service->scopeStatus,
      "scopeNote": service->scopeNote,
      "cardImage": coalesce(
        coverImage.image.asset->url,
        coverImage.externalUrl,
        gallery[0].image.asset->url,
        gallery[0].externalUrl,
        workingPhotos[0].image.asset->url,
        workingPhotos[0].externalUrl
      )
    }
  }
`)

export const SERVICE_PAGE_QUERY = defineQuery(`
  {
    "serviceRoutes": *[_type == "servicePage"] {
      "serviceSlug": service->slug.current,
      "areaSlug": area->slug.current,
      "clusterSlug": service->cluster->slug.current
    },
    "page": *[
      _type == "servicePage" &&
      service->slug.current == $serviceSlug &&
      area->slug.current == $areaSlug
    ][0] {
      _id,
      title,
      serviceId,
      seo,
      reviews[]{_key, quote, summary, author, date, location, sourceUrl, sourceId, verifiedAt},
      trustMetrics,
      coverImage{..., "resolvedUrl": coalesce(image.asset->url, externalUrl)},
      gallery[]{..., "resolvedUrl": coalesce(image.asset->url, externalUrl)},
      workingPhotos[]{..., "resolvedUrl": coalesce(image.asset->url, externalUrl)},
      guides,
      formSubtitle,
      formNote,
      localFaqOverrides,
      template->{name, version, active, sectionOrder, presentation},
      service->{
        serviceId,
        name,
        "slug": slug.current,
        cluster->{name, "slug": slug.current},
        parentName,
        parentUrl,
        hubUrl,
        primaryKeywords,
        monthlySearchVolume,
        searchVolumeSummary,
        secondaryKeywords,
        h1Prefix,
        heroLede,
        secondaryCta,
        issueQuestion,
        issueOptions,
        typesHeading,
        typesLede,
        types,
        typesFootnote,
        brandsHeading,
        brandsLede,
        brands,
        brandsNote,
        whyHeading,
        whyLede,
        whyItems,
        featuredCategory,
        otherServices,
        pricing,
        faqs,
        ctaHeading,
        ctaBody
      },
      area->{
        name,
        "slug": slug.current,
        state,
        heroEyebrow,
        galleryLabel,
        addressPlaceholder,
        buildingTypes,
        workingLede,
        areasHeading,
        areasLede,
        areasNote,
        subAreas[]{..., photo{..., "resolvedUrl": coalesce(image.asset->url, externalUrl)}},
        mapQuery,
        libraryHeading,
        libraryLede,
        localFaqs
      }
    },
    "settings": *[_id == "siteSettings"][0] {
      companyName,
      siteUrl,
      phoneDisplay,
      phoneE164,
      email,
      address,
      shopLocation,
      schemaBusinessType,
      brand,
      google,
      trustLines,
      trustHeading,
      trustLede,
      trustMetrics,
      trustCards,
      reviewsHeading,
      reviewsDisclaimer,
      formSubtitle,
      formNote
    }
  }
`)

export const SERVICE_PAGE_METADATA_QUERY = defineQuery(`
  *[
    _type == "servicePage" &&
    service->slug.current == $serviceSlug &&
    area->slug.current == $areaSlug
  ][0] {"title": seo.title, "description": seo.description, "canonicalUrl": seo.canonicalUrl}
`)
