/** Structured data for search engines (schema.org JSON-LD). `<` is escaped so the JSON can't close the script tag. */
const JsonLd = ({ data }: { data: Record<string, unknown> }) => (
  <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />
)

export default JsonLd
